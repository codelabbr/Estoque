"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { mapDbError } from "@/lib/errors";
import { invalid, PERMISSION_DENIED, type ActionResult } from "@/lib/actions";
import {
  epiRequirementSchema,
  epiRequirementUpdateSchema,
  jobRoleSchema,
  sectorSchema,
  trainingRequirementSchema,
  unitSchema,
} from "./schemas";

async function guard(orgSlug: string) {
  const ctx = await getOrgContext(orgSlug);
  return canManageRegistry(ctx.role) ? ctx : null;
}

// ── Unidades ──────────────────────────────────────────────────────────────
export async function createUnit(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .insert({ organization_id: ctx.org.id, name: parsed.data.name });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/configuracoes`);
  return { ok: true, data: undefined };
}

export async function archiveUnit(
  orgSlug: string,
  id: string,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/configuracoes`);
  return { ok: true, data: undefined };
}

// ── Setores ───────────────────────────────────────────────────────────────
export async function createSector(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = sectorSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("sectors").insert({
    organization_id: ctx.org.id,
    name: parsed.data.name,
    unit_id: parsed.data.unitId,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/configuracoes`);
  return { ok: true, data: undefined };
}

export async function archiveSector(
  orgSlug: string,
  id: string,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("sectors")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/configuracoes`);
  return { ok: true, data: undefined };
}

// ── Cargos ────────────────────────────────────────────────────────────────
export async function createJobRole(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = jobRoleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_roles")
    .insert({
      organization_id: ctx.org.id,
      name: parsed.data.name,
      cbo: parsed.data.cbo,
      description: parsed.data.description,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/cargos`);
  return { ok: true, data: { redirectTo: `/${orgSlug}/cargos/${data.id}` } };
}

export async function updateJobRole(
  orgSlug: string,
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = jobRoleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_roles")
    .update({
      name: parsed.data.name,
      cbo: parsed.data.cbo,
      description: parsed.data.description,
    })
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/cargos`);
  revalidatePath(`/${orgSlug}/cargos/${id}`);
  return { ok: true, data: undefined };
}

export async function archiveJobRole(
  orgSlug: string,
  id: string,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_roles")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/cargos`);
  return { ok: true, data: undefined };
}

// ── Matriz de exigências ──────────────────────────────────────────────────
export async function addEpiRequirement(
  orgSlug: string,
  jobRoleId: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = epiRequirementSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("job_role_epi_requirements").insert({
    organization_id: ctx.org.id,
    job_role_id: jobRoleId,
    epi_id: parsed.data.epiId,
    quantity: parsed.data.quantity,
    replacement_days: parsed.data.replacementDays,
    mandatory: parsed.data.mandatory,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidateMatrix(orgSlug, jobRoleId);
  return { ok: true, data: undefined };
}

export async function updateEpiRequirement(
  orgSlug: string,
  jobRoleId: string,
  epiId: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = epiRequirementUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_role_epi_requirements")
    .update({
      quantity: parsed.data.quantity,
      replacement_days: parsed.data.replacementDays,
      mandatory: parsed.data.mandatory,
    })
    .eq("organization_id", ctx.org.id)
    .eq("job_role_id", jobRoleId)
    .eq("epi_id", epiId);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidateMatrix(orgSlug, jobRoleId);
  return { ok: true, data: undefined };
}

/** A matriz muda sugestões de entrega e a conformidade do dashboard. */
function revalidateMatrix(orgSlug: string, jobRoleId: string) {
  revalidatePath(`/${orgSlug}/cargos/${jobRoleId}`);
  revalidatePath(`/${orgSlug}/cargos`);
  revalidatePath(`/${orgSlug}/dashboard`);
}

export async function removeEpiRequirement(
  orgSlug: string,
  jobRoleId: string,
  epiId: string,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_role_epi_requirements")
    .delete()
    .eq("organization_id", ctx.org.id)
    .eq("job_role_id", jobRoleId)
    .eq("epi_id", epiId);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidateMatrix(orgSlug, jobRoleId);
  return { ok: true, data: undefined };
}

export async function addTrainingRequirement(
  orgSlug: string,
  jobRoleId: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = trainingRequirementSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_role_training_requirements")
    .insert({
      organization_id: ctx.org.id,
      job_role_id: jobRoleId,
      training_type_id: parsed.data.trainingTypeId,
    });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/cargos/${jobRoleId}`);
  return { ok: true, data: undefined };
}

export async function removeTrainingRequirement(
  orgSlug: string,
  jobRoleId: string,
  trainingTypeId: string,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_role_training_requirements")
    .delete()
    .eq("organization_id", ctx.org.id)
    .eq("job_role_id", jobRoleId)
    .eq("training_type_id", trainingTypeId);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/${orgSlug}/cargos/${jobRoleId}`);
  return { ok: true, data: undefined };
}
