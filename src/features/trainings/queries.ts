import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE } from "@/components/shared/pagination";
import type { TrainingStatus } from "./constants";

export async function listTrainingTypes(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_types")
    .select("id, name, regulation, validity_months, workload_hours")
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

export type MatrixCell = {
  status: TrainingStatus;
  required: boolean;
  expiresAt: string | null;
  completedAt: string | null;
  hasCertificate: boolean;
};

/** Matriz funcionários × treinamentos (só tipos que aparecem em algum cargo ou registro). */
export async function getTrainingMatrix(
  orgId: string,
  opts: { jobRoleId?: string; onlyIssues?: boolean },
) {
  const supabase = await createClient();
  let query = supabase
    .from("v_employee_training_status")
    .select(
      "employee_id, employee_name, job_role_id, training_type_id, training_name, regulation, required, status, expires_at, completed_at, has_certificate",
    )
    .eq("organization_id", orgId);
  if (opts.jobRoleId) query = query.eq("job_role_id", opts.jobRoleId);
  const { data, error } = await query;
  if (error) throw error;

  const types = new Map<
    string,
    { id: string; name: string; regulation: string | null }
  >();
  const employees = new Map<
    string,
    { id: string; name: string; cells: Record<string, MatrixCell> }
  >();
  for (const r of data) {
    if (!r.training_type_id || !r.employee_id) continue;
    types.set(r.training_type_id, {
      id: r.training_type_id,
      name: r.training_name!,
      regulation: r.regulation,
    });
    const emp = employees.get(r.employee_id) ?? {
      id: r.employee_id,
      name: r.employee_name!,
      cells: {},
    };
    emp.cells[r.training_type_id] = {
      status: r.status as TrainingStatus,
      required: !!r.required,
      expiresAt: r.expires_at,
      completedAt: r.completed_at,
      hasCertificate: !!r.has_certificate,
    };
    employees.set(r.employee_id, emp);
  }
  let rows = [...employees.values()].sort((x, y) =>
    x.name.localeCompare(y.name, "pt-BR"),
  );
  if (opts.onlyIssues) {
    rows = rows.filter((e) =>
      Object.values(e.cells).some(
        (c) =>
          c.status === "vencido" ||
          c.status === "a_vencer" ||
          (c.status === "pendente" && c.required),
      ),
    );
  }
  const columns = [...types.values()].sort((x, y) =>
    x.name.localeCompare(y.name, "pt-BR", { numeric: true }),
  );
  return { columns, rows };
}

export async function listTrainingRecords(orgId: string, page: number) {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("employee_trainings")
    .select(
      "id, completed_at, expires_at, provider, instructor, certificate_path, batch_id, employees(id, full_name), training_types(name, regulation)",
      { count: "exact" },
    )
    .eq("organization_id", orgId)
    .order("completed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

/** Status atual de cada treinamento do funcionário. */
export async function getEmployeeTrainingStatus(
  orgId: string,
  employeeId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_employee_training_status")
    .select(
      "training_type_id, training_name, regulation, required, status, completed_at, expires_at, has_certificate, last_training_id",
    )
    .eq("organization_id", orgId)
    .eq("employee_id", employeeId);
  if (error) throw error;
  return data.sort((x, y) =>
    (x.training_name ?? "").localeCompare(y.training_name ?? "", "pt-BR", {
      numeric: true,
    }),
  );
}

export async function getEmployeeTrainingHistory(
  orgId: string,
  employeeId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employee_trainings")
    .select(
      "id, completed_at, expires_at, provider, instructor, certificate_path, training_types(name)",
    )
    .eq("organization_id", orgId)
    .eq("employee_id", employeeId)
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getEmployeeCompliance(orgId: string, employeeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_employee_compliance")
    .select("status, issues")
    .eq("organization_id", orgId)
    .eq("employee_id", employeeId)
    .maybeSingle();
  return data as {
    status: string;
    issues: {
      kind: string;
      label: string;
      due_date: string | null;
      severity: string;
    }[];
  } | null;
}

/** Funcionários ativos com o status no tipo escolhido, para montar a turma. */
export async function listEmployeesForBatch(
  orgId: string,
  trainingTypeId?: string,
) {
  const supabase = await createClient();
  const [employees, statuses] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, job_roles(name), sectors(name)")
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .is("terminated_at", null)
      .order("full_name"),
    trainingTypeId
      ? supabase
          .from("v_employee_training_status")
          .select("employee_id, status, required")
          .eq("organization_id", orgId)
          .eq("training_type_id", trainingTypeId)
      : Promise.resolve({
          data: [] as {
            employee_id: string | null;
            status: string | null;
            required: boolean | null;
          }[],
        }),
  ]);
  if (employees.error) throw employees.error;
  const byEmployee = new Map(
    (statuses.data ?? []).map((s) => [s.employee_id, s]),
  );
  return employees.data.map((e) => {
    const s = byEmployee.get(e.id);
    return {
      id: e.id,
      name: e.full_name,
      detail: [e.job_roles?.name, e.sectors?.name].filter(Boolean).join(" · "),
      status: (s?.status ?? null) as TrainingStatus | null,
      required: !!s?.required,
    };
  });
}
