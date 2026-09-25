import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listUnits(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("id, name")
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

export async function listSectors(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sectors")
    .select("id, name, unit_id, units(name)")
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

export async function listJobRoles(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_roles")
    .select(
      "id, name, cbo, employees(count), job_role_epi_requirements(count), job_role_training_requirements(count)",
    )
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .is("employees.archived_at", null)
    .order("name");
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    cbo: r.cbo,
    employeeCount: r.employees[0]?.count ?? 0,
    epiCount: r.job_role_epi_requirements[0]?.count ?? 0,
    trainingCount: r.job_role_training_requirements[0]?.count ?? 0,
  }));
}

/** Nomes de todos os cargos (inclusive arquivados): a importação os reaproveita pelo nome. */
export async function listJobRoleNames(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_roles")
    .select("name")
    .eq("organization_id", orgId);
  if (error) throw error;
  return data.map((r) => r.name);
}

export async function getJobRole(orgId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_roles")
    .select(
      "id, name, cbo, description, archived_at, job_role_epi_requirements(quantity, replacement_days, mandatory, epis(id, name, ca_number, category, lifespan_days)), job_role_training_requirements(training_types(id, name, regulation, validity_months))",
    )
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTrainingTypeOptions(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_types")
    .select("id, name, regulation, validity_months")
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data;
}
