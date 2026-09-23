"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry, isOrgAdmin } from "@/lib/permissions";
import { mapDbError } from "@/lib/errors";
import { todayInSaoPaulo } from "@/lib/format";
import { invalid, PERMISSION_DENIED, type ActionResult } from "@/lib/actions";
import { batchSchema, trainingTypeSchema } from "./schemas";

async function guard(orgSlug: string) {
  const ctx = await getOrgContext(orgSlug);
  return canManageRegistry(ctx.role) ? ctx : null;
}

function revalidate(orgSlug: string) {
  revalidatePath(`/${orgSlug}/treinamentos`, "layout");
  revalidatePath(`/${orgSlug}/funcionarios`, "layout");
  revalidatePath(`/${orgSlug}/dashboard`);
  revalidatePath(`/${orgSlug}/alertas`);
}

export async function createTrainingType(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = trainingTypeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("training_types").insert({
    organization_id: ctx.org.id,
    name: parsed.data.name,
    regulation: parsed.data.regulation,
    validity_months: parsed.data.validityMonths,
    workload_hours: parsed.data.workloadHours,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return { ok: true, data: undefined };
}

export async function updateTrainingType(
  orgSlug: string,
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = trainingTypeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_types")
    .update({
      name: parsed.data.name,
      regulation: parsed.data.regulation,
      validity_months: parsed.data.validityMonths,
      workload_hours: parsed.data.workloadHours,
    })
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return { ok: true, data: undefined };
}

export async function archiveTrainingType(
  orgSlug: string,
  id: string,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_types")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return { ok: true, data: undefined };
}

export async function registerTrainingBatch(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = batchSchema.safeParse({
    ...(input as object),
    today: todayInSaoPaulo(),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.certificatePath && !d.certificatePath.startsWith(`${ctx.org.id}/`)) {
    return { ok: false, error: "Certificado inválido." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_training_batch", {
    p_org: ctx.org.id,
    p_training_type: d.trainingTypeId,
    p_completed_at: d.completedAt,
    p_employee_ids: d.employeeIds,
    p_provider: d.provider ?? undefined,
    p_instructor: d.instructor ?? undefined,
    p_workload_hours: d.workloadHours ?? undefined,
    p_certificate_path: d.certificatePath ?? undefined,
    p_expires_at: d.expiresAt ?? undefined,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return { ok: true, data: { count: new Set(d.employeeIds).size } };
}

export async function deleteTrainingRecord(
  orgSlug: string,
  id: string,
): Promise<ActionResult> {
  const ctx = await getOrgContext(orgSlug);
  if (!isOrgAdmin(ctx.role)) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("employee_trainings")
    .delete()
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  return { ok: true, data: undefined };
}

/** URL assinada de 60 s para ver um certificado. */
export async function getCertificateUrl(
  orgSlug: string,
  path: string,
): Promise<ActionResult<{ url: string }>> {
  const ctx = await getOrgContext(orgSlug);
  if (!path.startsWith(`${ctx.org.id}/`))
    return { ok: false, error: "Certificado não encontrado." };
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("certificates")
    .createSignedUrl(path, 60);
  if (error || !data)
    return { ok: false, error: "Não foi possível abrir o certificado." };
  return { ok: true, data: { url: data.signedUrl } };
}
