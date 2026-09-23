"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { canOperateStock } from "@/lib/permissions";
import { mapDbError } from "@/lib/errors";
import { getSiteUrl } from "@/lib/url";
import { invalid, PERMISSION_DENIED, type ActionResult } from "@/lib/actions";
import {
  cancelDeliverySchema,
  dataUrlToBytea,
  deliverySchema,
  returnItemSchema,
  signatureSchema,
} from "./schemas";
import { searchActiveEmployees } from "./queries";

async function guard(orgSlug: string) {
  const ctx = await getOrgContext(orgSlug);
  return canOperateStock(ctx.role) ? ctx : null;
}

function revalidate(orgSlug: string, employeeId?: string) {
  revalidatePath(`/${orgSlug}/entregas`, "layout");
  revalidatePath(`/${orgSlug}/estoque`, "layout");
  revalidatePath(`/${orgSlug}/dashboard`);
  revalidatePath(`/${orgSlug}/alertas`);
  if (employeeId) revalidatePath(`/${orgSlug}/funcionarios/${employeeId}`);
}

export async function searchEmployeesForCounter(orgSlug: string, q: string) {
  const ctx = await getOrgContext(orgSlug);
  if (q.trim().length < 2) return [];
  const rows = await searchActiveEmployees(ctx.org.id, q);
  return rows.map((e) => ({
    id: e.id,
    name: e.full_name,
    detail: [
      e.job_roles?.name,
      e.registration && `Mat. ${e.registration}`,
      `CPF ***.${e.cpf.slice(3, 6)}.${e.cpf.slice(6, 9)}-**`,
    ]
      .filter(Boolean)
      .join(" · "),
  }));
}

export async function deliverEpis(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = deliverySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deliver_epis", {
    p_org: ctx.org.id,
    p_employee: parsed.data.employeeId,
    p_location: parsed.data.locationId,
    p_items: parsed.data.items.map((i) => ({
      variant_id: i.variantId,
      quantity: i.quantity,
      reason: i.reason,
      ca_override: i.caOverride,
    })),
    p_notes: parsed.data.notes ?? undefined,
  });
  if (error) {
    let message = mapDbError(error);
    if (error.message.includes("saldo_insuficiente") && error.details) {
      try {
        const d = JSON.parse(error.details) as {
          epi: string;
          tamanho: string;
          saldo: number;
        };
        message = `Saldo insuficiente de ${d.epi} ${d.tamanho}: há ${d.saldo} em estoque.`;
      } catch {}
    }
    if (error.message.includes("ca_vencido") && error.details) {
      try {
        const d = JSON.parse(error.details) as { epi: string };
        message = `O CA de ${d.epi} está vencido. Marque “Entregar mesmo assim” para confirmar.`;
      } catch {}
    }
    return { ok: false, error: message };
  }
  revalidate(orgSlug, parsed.data.employeeId);
  return { ok: true, data: { id: data } };
}

export async function cancelDelivery(
  orgSlug: string,
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = cancelDeliverySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_delivery", {
    p_delivery: id,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return { ok: true, data: undefined };
}

/**
 * Gera um link de assinatura (token de 32 bytes, só o hash vai ao banco).
 * O token em claro só existe nesta resposta.
 */
export async function createSignatureLink(
  orgSlug: string,
  deliveryId: string,
): Promise<
  ActionResult<{
    url: string;
    whatsappUrl: string | null;
    expiresInHours: number;
  }>
> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { data: delivery } = await supabase
    .from("epi_deliveries")
    .select("employee_name_snapshot, employees(phone)")
    .eq("organization_id", ctx.org.id)
    .eq("id", deliveryId)
    .maybeSingle();
  if (!delivery) return { ok: false, error: "Entrega não encontrada." };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const { error } = await supabase.rpc("create_signature_request", {
    p_delivery: deliveryId,
    p_channel: "link",
    p_token_hash: tokenHash,
    p_valid_hours: 72,
  });
  if (error) return { ok: false, error: mapDbError(error) };

  const url = `${getSiteUrl()}/assinar/${token}`;
  const firstName = delivery.employee_name_snapshot.split(" ")[0];
  const phone = delivery.employees?.phone;
  const message = `Olá, ${firstName}! ${ctx.org.name} registrou a entrega dos seus EPIs. Confira e assine por este link (válido por 72 horas): ${url}`;
  revalidatePath(`/${orgSlug}/entregas/${deliveryId}`);
  return {
    ok: true,
    data: {
      url,
      whatsappUrl: phone
        ? `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`
        : null,
      expiresInHours: 72,
    },
  };
}

export async function signInPerson(
  orgSlug: string,
  deliveryId: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = signatureSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const userAgent = (await headers()).get("user-agent") ?? undefined;

  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_delivery_in_person", {
    p_delivery: deliveryId,
    p_method: parsed.data.method,
    p_image_png:
      parsed.data.method === "desenho"
        ? dataUrlToBytea(parsed.data.imagePng)
        : undefined,
    p_typed_name:
      parsed.data.method === "nome_digitado"
        ? parsed.data.typedName
        : undefined,
    p_user_agent: userAgent,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return { ok: true, data: undefined };
}

export async function returnItem(
  orgSlug: string,
  itemId: string,
  employeeId: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = returnItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_epi", {
    p_item: itemId,
    p_destination: parsed.data.destination,
    p_notes: parsed.data.notes ?? undefined,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug, employeeId);
  return { ok: true, data: undefined };
}
