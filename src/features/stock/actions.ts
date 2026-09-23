"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { canOperateStock, isOrgAdmin } from "@/lib/permissions";
import { mapDbError } from "@/lib/errors";
import { invalid, PERMISSION_DENIED, type ActionResult } from "@/lib/actions";
import {
  adjustSchema,
  discardSchema,
  entrySchema,
  inventorySchema,
  reverseSchema,
} from "./schemas";

async function guard(orgSlug: string) {
  const ctx = await getOrgContext(orgSlug);
  return canOperateStock(ctx.role) ? ctx : null;
}

function revalidate(orgSlug: string) {
  revalidatePath(`/${orgSlug}/estoque`, "layout");
  revalidatePath(`/${orgSlug}/dashboard`);
  revalidatePath(`/${orgSlug}/alertas`);
}

export async function registerEntry(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult<{ groupId: string }>> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_stock_entry", {
    p_org: ctx.org.id,
    p_location: parsed.data.locationId,
    p_items: parsed.data.items.map((i) => ({
      variant_id: i.variantId,
      quantity: i.quantity,
      unit_cost: i.unitCost,
      batch: i.batch,
      batch_expires_at: i.batchExpiresAt,
    })),
    p_supplier: parsed.data.supplier ?? undefined,
    p_document_ref: parsed.data.documentRef ?? undefined,
    p_occurred_on: parsed.data.occurredOn ?? undefined,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return { ok: true, data: { groupId: data } };
}

export async function adjustStock(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", {
    p_org: ctx.org.id,
    p_location: parsed.data.locationId,
    p_variant: parsed.data.variantId,
    p_delta:
      parsed.data.direction === "entrada"
        ? parsed.data.quantity
        : -parsed.data.quantity,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return { ok: true, data: undefined };
}

export async function discardStock(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = discardSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_stock", {
    p_org: ctx.org.id,
    p_location: parsed.data.locationId,
    p_variant: parsed.data.variantId,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return { ok: true, data: undefined };
}

export async function reverseMovement(
  orgSlug: string,
  movementId: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = reverseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_stock_movement", {
    p_movement: movementId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return { ok: true, data: undefined };
}

export async function applyInventory(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult<{ adjusted: number }>> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = inventorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_inventory", {
    p_org: ctx.org.id,
    p_location: parsed.data.locationId,
    p_counts: parsed.data.counts.map((c) => ({
      variant_id: c.variantId,
      counted: c.counted,
    })),
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return {
    ok: true,
    data: { adjusted: (data as { adjusted: number }).adjusted },
  };
}

const locationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(80),
});

export async function createLocation(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await getOrgContext(orgSlug);
  if (!isOrgAdmin(ctx.role)) return PERMISSION_DENIED;
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("stock_locations")
    .insert({ organization_id: ctx.org.id, name: parsed.data.name });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Já existe um local com este nome."
          : mapDbError(error),
    };
  }
  revalidatePath(`/${orgSlug}/configuracoes`);
  revalidate(orgSlug);
  return { ok: true, data: undefined };
}

export async function archiveLocation(
  orgSlug: string,
  id: string,
): Promise<ActionResult> {
  const ctx = await getOrgContext(orgSlug);
  if (!isOrgAdmin(ctx.role)) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { data: location } = await supabase
    .from("stock_locations")
    .select("is_default")
    .eq("organization_id", ctx.org.id)
    .eq("id", id)
    .maybeSingle();
  if (location?.is_default) {
    return { ok: false, error: "O local padrão não pode ser arquivado." };
  }
  const { data: balances } = await supabase
    .from("v_stock_balance")
    .select("balance")
    .eq("location_id", id)
    .gt("balance", 0)
    .limit(1);
  if (balances?.length) {
    return {
      ok: false,
      error:
        "Este local ainda tem saldo. Zere o estoque (ajuste ou descarte) antes de arquivar.",
    };
  }
  const { error } = await supabase
    .from("stock_locations")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/configuracoes`);
  revalidate(orgSlug);
  return { ok: true, data: undefined };
}
