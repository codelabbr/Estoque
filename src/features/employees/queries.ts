import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE } from "@/components/shared/pagination";

export type EmployeeFilter = "ativos" | "desligados" | "arquivados";

export async function listEmployees(
  orgId: string,
  opts: {
    q?: string;
    filter: EmployeeFilter;
    jobRoleId?: string;
    page: number;
  },
) {
  const supabase = await createClient();
  let query = supabase
    .from("employees")
    .select(
      "id, full_name, cpf, registration, terminated_at, archived_at, job_roles(name), sectors(name)",
      { count: "exact" },
    )
    .eq("organization_id", orgId)
    .order("full_name")
    .range((opts.page - 1) * PAGE_SIZE, opts.page * PAGE_SIZE - 1);

  if (opts.filter === "arquivados")
    query = query.not("archived_at", "is", null);
  else {
    query = query.is("archived_at", null);
    query =
      opts.filter === "desligados"
        ? query.not("terminated_at", "is", null)
        : query.is("terminated_at", null);
  }
  if (opts.jobRoleId) query = query.eq("job_role_id", opts.jobRoleId);
  if (opts.q) {
    const q = opts.q.replace(/[%,()]/g, " ").trim();
    const digits = q.replace(/\D/g, "");
    const filters = [`full_name.ilike.%${q}%`, `registration.ilike.%${q}%`];
    if (digits.length >= 3) filters.push(`cpf.like.%${digits}%`);
    query = query.or(filters.join(","));
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function countEmployees(orgId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .is("terminated_at", null);
  return count ?? 0;
}

export async function getEmployee(orgId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, full_name, cpf, registration, phone, email, hired_at, terminated_at, archived_at, created_at, job_role_id, sector_id, unit_id, job_roles(id, name), sectors(id, name), units(id, name)",
    )
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Cargos, setores e unidades ativos para os selects do formulário. */
export async function getEmployeeFormOptions(orgId: string) {
  const supabase = await createClient();
  const [jobRoles, sectors, units] = await Promise.all([
    supabase
      .from("job_roles")
      .select("id, name")
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("sectors")
      .select("id, name")
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("units")
      .select("id, name")
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .order("name"),
  ]);
  return {
    jobRoles: jobRoles.data ?? [],
    sectors: sectors.data ?? [],
    units: units.data ?? [],
  };
}
