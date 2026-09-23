"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { mapDbError } from "@/lib/errors";
import { invalid, PERMISSION_DENIED, type ActionResult } from "@/lib/actions";
import { isValidCpf } from "@/lib/validators";
import { employeeSchema, terminateSchema, toDbEmployee } from "./schemas";

async function guard(orgSlug: string) {
  const ctx = await getOrgContext(orgSlug);
  return canManageRegistry(ctx.role) ? ctx : null;
}

function revalidate(orgSlug: string, id?: string) {
  revalidatePath(`/${orgSlug}/funcionarios`);
  if (id) revalidatePath(`/${orgSlug}/funcionarios/${id}`);
  revalidatePath(`/${orgSlug}/dashboard`);
}

export async function createEmployee(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .insert({ organization_id: ctx.org.id, ...toDbEmployee(parsed.data) })
    .select("id")
    .single();
  if (error) {
    const message = mapDbError(error);
    return {
      ok: false,
      error: message,
      fieldErrors: message.includes("CPF")
        ? { cpf: [message] }
        : message.includes("matrícula")
          ? { registration: [message] }
          : undefined,
    };
  }
  revalidate(orgSlug);
  return { ok: true, data: { id: data.id } };
}

export async function updateEmployee(
  orgSlug: string,
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update(toDbEmployee(parsed.data))
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) {
    const message = mapDbError(error);
    return {
      ok: false,
      error: message,
      fieldErrors: message.includes("CPF") ? { cpf: [message] } : undefined,
    };
  }
  revalidate(orgSlug, id);
  return { ok: true, data: { id } };
}

export async function terminateEmployee(
  orgSlug: string,
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = terminateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ terminated_at: parsed.data.terminatedAt })
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) {
    return {
      ok: false,
      error: error.message.includes("check")
        ? "A data de desligamento não pode ser anterior à admissão."
        : mapDbError(error),
    };
  }
  revalidate(orgSlug, id);
  return { ok: true, data: undefined };
}

export async function reactivateEmployee(
  orgSlug: string,
  id: string,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ terminated_at: null, archived_at: null })
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug, id);
  return { ok: true, data: undefined };
}

export async function archiveEmployee(
  orgSlug: string,
  id: string,
): Promise<ActionResult> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", ctx.org.id)
    .eq("id", id);
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug, id);
  return { ok: true, data: undefined };
}

const importRowSchema = z.object({
  fullName: z.string().trim().min(3),
  cpf: z.string().refine(isValidCpf),
  registration: z.string().nullable(),
  jobRole: z.string().nullable(),
  sector: z.string().nullable(),
  hiredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});

export async function importEmployees(
  orgSlug: string,
  rows: unknown,
): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  const ctx = await guard(orgSlug);
  if (!ctx) return PERMISSION_DENIED;
  const parsed = z.array(importRowSchema).min(1).max(2000).safeParse(rows);
  if (!parsed.success) {
    return {
      ok: false,
      error: "A planilha tem linhas inválidas. Corrija e tente de novo.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_employees", {
    p_org: ctx.org.id,
    p_rows: parsed.data.map((r) => ({
      full_name: r.fullName,
      cpf: r.cpf,
      registration: r.registration,
      job_role: r.jobRole,
      sector: r.sector,
      hired_at: r.hiredAt,
      phone: r.phone,
      email: r.email,
    })),
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidate(orgSlug);
  revalidatePath(`/${orgSlug}/cargos`);
  const result = data as { inserted: number; skipped: number };
  return {
    ok: true,
    data: { inserted: result.inserted, skipped: result.skipped },
  };
}
