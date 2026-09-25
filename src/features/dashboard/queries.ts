import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { describeActivity, type ActivityEntry } from "./utils";
import {
  rankBySector,
  summarize,
  todayActions,
  type ComplianceRow,
  type ComplianceSummary,
  type Pendencia,
  type SectorRank,
  type TodayAction,
} from "./compliance";
import { alertAction } from "@/features/alerts/constants";
import { listAlerts } from "@/features/alerts/queries";

export type DashboardData = {
  memberCount: number;
  activity: ActivityEntry[];
  /** Distribuição para o card: em dia sem avisos / em dia com avisos / irregular. */
  compliance: { ok: number; atencao: number; irregular: number; total: number };
  summary: ComplianceSummary;
  sectorRanking: SectorRank[];
  pendingSignatures: number;
  deliveriesThisWeek: number;
  /** "O que fazer hoje": pendências que tornam irregular + estoque abaixo do mínimo. */
  today: TodayAction[];
  todayTotal: number;
  alertCounts: { critico: number; atencao: number };
  stockCritical: number;
  casExpiring: number;
  setup: {
    epis: boolean;
    matrix: boolean;
    employees: boolean;
    stockEntry: boolean;
    delivery: boolean;
    team: boolean;
  };
};

const TODAY_LIMIT = 8;

/** Tudo o que o dashboard mostra, em paralelo. Nada de número inventado. */
export async function getDashboardData(
  orgId: string,
  orgSlug: string,
  userId: string,
  orgName: string,
): Promise<DashboardData> {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const head = { count: "exact" as const, head: true };

  const [
    members,
    audit,
    conformidade,
    sectors,
    pending,
    weekDeliveries,
    alerts,
    epis,
    employees,
    entries,
    anyDelivery,
    matrix,
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id", head)
      .eq("organization_id", orgId),
    supabase
      .from("audit_log")
      .select("id, action, table_name, actor_id, created_at, new_data")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.rpc("fn_conformidade_funcionarios", { p_org: orgId }),
    supabase.from("sectors").select("id, name").eq("organization_id", orgId),
    supabase
      .from("epi_deliveries")
      .select("id", head)
      .eq("organization_id", orgId)
      .eq("signature_status", "pendente"),
    supabase
      .from("epi_deliveries")
      .select("id", head)
      .eq("organization_id", orgId)
      .neq("signature_status", "cancelada")
      .gte("delivered_at", weekAgo),
    listAlerts(orgId),
    supabase
      .from("epis")
      .select("id", head)
      .eq("organization_id", orgId)
      .is("archived_at", null),
    supabase
      .from("employees")
      .select("id", head)
      .eq("organization_id", orgId)
      .is("archived_at", null),
    supabase
      .from("stock_movements")
      .select("id", head)
      .eq("organization_id", orgId)
      .eq("type", "entrada"),
    supabase
      .from("epi_deliveries")
      .select("id", head)
      .eq("organization_id", orgId),
    supabase
      .from("job_role_epi_requirements")
      .select("epi_id", head)
      .eq("organization_id", orgId),
  ]);
  if (conformidade.error) throw conformidade.error;

  const sectorName = new Map(
    (sectors.data ?? []).map((s) => [s.id, s.name] as const),
  );
  const rows: ComplianceRow[] = (conformidade.data ?? []).map((r) => ({
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    sectorName: r.sector_id ? (sectorName.get(r.sector_id) ?? null) : null,
    status: r.status === "irregular" ? "irregular" : "em_dia",
    pendencias: (r.pendencias ?? []) as unknown as Pendencia[],
  }));

  const dist = { ok: 0, atencao: 0, irregular: 0, total: rows.length };
  for (const r of rows) {
    if (r.status === "irregular") dist.irregular += 1;
    else if (r.pendencias.length > 0) dist.atencao += 1;
    else dist.ok += 1;
  }

  const stockAlerts = alerts.filter((a) => a.kind === "estoque_minimo");
  const today: TodayAction[] = [
    ...todayActions(rows, orgSlug),
    ...stockAlerts.map((a): TodayAction => ({
      key: a.alert_key,
      title: a.title,
      detail: "Estoque abaixo do mínimo",
      severity: a.severity === "critico" ? "critico" : "atencao",
      action: alertAction(a, orgSlug),
    })),
  ];

  return {
    memberCount: members.count ?? 1,
    activity: (audit.data ?? []).map((row) =>
      describeActivity(
        {
          id: row.id,
          action: row.action,
          tableName: row.table_name,
          actorId: row.actor_id,
          createdAt: row.created_at,
          newData: row.new_data as Record<string, Json> | null,
        },
        { currentUserId: userId, organizationName: orgName },
      ),
    ),
    compliance: dist,
    summary: summarize(rows),
    sectorRanking: rankBySector(rows),
    pendingSignatures: pending.count ?? 0,
    deliveriesThisWeek: weekDeliveries.count ?? 0,
    today: today.slice(0, TODAY_LIMIT),
    todayTotal: today.length,
    alertCounts: {
      critico: alerts.filter((a) => a.severity === "critico").length,
      atencao: alerts.filter((a) => a.severity === "atencao").length,
    },
    stockCritical: stockAlerts.length,
    casExpiring: alerts.filter((a) => a.kind === "ca_a_vencer").length,
    setup: {
      epis: (epis.count ?? 0) > 0,
      matrix: (matrix.count ?? 0) > 0,
      employees: (employees.count ?? 0) > 0,
      stockEntry: (entries.count ?? 0) > 0,
      delivery: (anyDelivery.count ?? 0) > 0,
      team: (members.count ?? 1) > 1,
    },
  };
}
