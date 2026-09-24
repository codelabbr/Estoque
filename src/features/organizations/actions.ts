"use server";

import { createHash, randomBytes } from "node:crypto";
import { getSiteUrl } from "@/lib/url";
import { emailChannel } from "@/lib/email/send";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/errors";
import { getOrgContext } from "@/lib/org";
import { isOrgAdmin, ROLE_LABELS } from "@/lib/permissions";
import { invalid, PERMISSION_DENIED, type ActionResult } from "@/lib/actions";
import { createOrganizationSchema, updateOrganizationSchema } from "./schemas";

export async function createOrganization(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const cnpj = parsed.data.cnpj
    ? parsed.data.cnpj.replace(/\D/g, "")
    : undefined;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_cnpj: cnpj,
  });

  if (error) {
    const message = error.message.includes("organizations_slug_key")
      ? "Este identificador já está em uso. Escolha outro."
      : mapDbError(error);
    return { ok: false, error: message };
  }

  return { ok: true, data: { slug: data!.slug } };
}

export async function updateOrganization(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await getOrgContext(orgSlug);
  if (!isOrgAdmin(ctx.role)) return PERMISSION_DENIED;
  const parsed = updateOrganizationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      legal_name: parsed.data.legalName,
      cnpj: parsed.data.cnpj,
      responsibility_term: parsed.data.responsibilityTerm,
      alert_days_ca: parsed.data.alertDaysCa,
      alert_days_epi: parsed.data.alertDaysEpi,
      alert_days_training: parsed.data.alertDaysTraining,
    })
    .eq("id", ctx.org.id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}`, "layout");
  return { ok: true, data: undefined };
}

const roleSchema = z.object({
  role: z.enum(["owner", "admin", "safety", "storekeeper", "viewer"], {
    error: "Selecione o papel",
  }),
});

export async function changeMemberRole(
  orgSlug: string,
  userId: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await getOrgContext(orgSlug);
  if (!isOrgAdmin(ctx.role)) return PERMISSION_DENIED;
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.role === "owner" && ctx.role !== "owner") {
    return {
      ok: false,
      error: "Só um proprietário pode promover outro proprietário.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .update({ role: parsed.data.role })
    .eq("organization_id", ctx.org.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/configuracoes`);
  return { ok: true, data: undefined };
}

export async function removeMember(
  orgSlug: string,
  userId: string,
): Promise<ActionResult> {
  const ctx = await getOrgContext(orgSlug);
  if (!isOrgAdmin(ctx.role)) return PERMISSION_DENIED;
  if (userId === ctx.user.id) {
    return { ok: false, error: "Você não pode remover a si mesmo." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", ctx.org.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/configuracoes`);
  return { ok: true, data: undefined };
}

const inviteSchema = z.object({
  email: z.email("E-mail inválido").transform((v) => v.toLowerCase().trim()),
  role: z.enum(["owner", "admin", "safety", "storekeeper", "viewer"], {
    error: "Selecione o papel",
  }),
});

export async function createInvite(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult<{ url: string; emailed: boolean }>> {
  const ctx = await getOrgContext(orgSlug);
  if (!isOrgAdmin(ctx.role)) return PERMISSION_DENIED;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const token = randomBytes(32).toString("base64url");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_invite", {
    p_org: ctx.org.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_token_hash: createHash("sha256").update(token, "utf8").digest("hex"),
  });
  if (error) return { ok: false, error: mapDbError(error) };

  const url = `${getSiteUrl()}/convite/${token}`;
  const sent = await emailChannel.send(
    parsed.data.email,
    `Convite para ${ctx.org.name} no Almox SST`,
    `<p>Você foi convidado para a equipe de <strong>${escapeHtml(ctx.org.name)}</strong> no Almox SST como <strong>${ROLE_LABELS[parsed.data.role]}</strong>.</p><p><a href="${url}">Aceitar convite</a> (válido por 7 dias). Se ainda não tem conta, crie com este mesmo e-mail.</p>`,
  );
  revalidatePath(`/${orgSlug}/configuracoes`);
  return { ok: true, data: { url, emailed: sent.ok } };
}

export async function revokeInvite(
  orgSlug: string,
  inviteId: string,
): Promise<ActionResult> {
  const ctx = await getOrgContext(orgSlug);
  if (!isOrgAdmin(ctx.role)) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invite", { p_invite: inviteId });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/configuracoes`);
  return { ok: true, data: undefined };
}

export async function acceptInvite(
  token: string,
): Promise<ActionResult<{ slug: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: { slug: data } };
}

export async function loadDemoData(orgSlug: string): Promise<ActionResult> {
  const ctx = await getOrgContext(orgSlug);
  if (!isOrgAdmin(ctx.role)) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("seed_demo_data", { p_org: ctx.org.id });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}`, "layout");
  return { ok: true, data: undefined };
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
