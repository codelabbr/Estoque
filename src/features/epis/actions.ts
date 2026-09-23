"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { mapDbError } from "@/lib/errors";
import { invalid, PERMISSION_DENIED, type ActionResult } from "@/lib/actions";
import { createEpiSchema, epiSchema, toDbEpi, variantSchema } from "./schemas";

async function guard(orgSlug: string) {
  const ctx = await getOrgContext(orgSlug);
  return canManageRegistry(ctx.role) ? ctx : null;
}

export async function createEpi(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = createEpiSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_epi", {
    p_org: ctx.org.id,
    p_epi: toDbEpi(parsed.data),
    p_sizes: parsed.data.sizes,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/epis`);
  return { ok: true, data: { id: data } };
}

export async function updateEpi(
  orgSlug: string,
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = epiSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("epis")
    .update(toDbEpi(parsed.data))
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/epis`);
  revalidatePath(`/${orgSlug}/epis/${id}`);
  return { ok: true, data: { id } };
}

export async function setEpiArchived(
  orgSlug: string,
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("epis")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/epis`);
  revalidatePath(`/${orgSlug}/epis/${id}`);
  return { ok: true, data: undefined };
}

export async function addVariant(
  orgSlug: string,
  epiId: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  // Tamanho arquivado com o mesmo nome é reativado em vez de duplicado.
  const { data: existing } = await supabase
    .from("epi_variants")
    .select("id, archived_at")
    .eq("organization_id", ctx.org.id)
    .eq("epi_id", epiId)
    .eq("size_label", parsed.data.sizeLabel)
    .maybeSingle();

  const { error } = existing?.archived_at
    ? await supabase
        .from("epi_variants")
        .update({
          archived_at: null,
          sku: parsed.data.sku,
          min_stock: parsed.data.minStock,
        })
        .eq("id", existing.id)
    : await supabase.from("epi_variants").insert({
        organization_id: ctx.org.id,
        epi_id: epiId,
        size_label: parsed.data.sizeLabel,
        sku: parsed.data.sku,
        min_stock: parsed.data.minStock,
      });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/epis/${epiId}`);
  return { ok: true, data: undefined };
}

export async function updateVariant(
  orgSlug: string,
  epiId: string,
  variantId: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("epi_variants")
    .update({
      size_label: parsed.data.sizeLabel,
      sku: parsed.data.sku,
      min_stock: parsed.data.minStock,
    })
    .eq("organization_id", ctx.org.id)
    .eq("id", variantId);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/epis/${epiId}`);
  return { ok: true, data: undefined };
}

export async function archiveVariant(
  orgSlug: string,
  epiId: string,
  variantId: string,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { count } = await supabase
    .from("epi_variants")
    .select("id", { count: "exact", head: true })
    .eq("epi_id", epiId)
    .is("archived_at", null);
  if ((count ?? 0) <= 1) {
    return {
      ok: false,
      error: "O EPI precisa ter pelo menos um tamanho ativo.",
    };
  }
  const { error } = await supabase
    .from("epi_variants")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", ctx.org.id)
    .eq("id", variantId);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/epis/${epiId}`);
  return { ok: true, data: undefined };
}
