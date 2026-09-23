import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { describeActivity, type ActivityEntry } from "./utils";
import type { AlertRow } from "@/features/alerts/constants";
import { listAlerts } from "@/features/alerts/queries";

export type DashboardData = {
  memberCount: number;
  activity: ActivityEntry[];
  compliance: { ok: number; atencao: number; irregular: number; total: number };
  pendingSignatures: number;
  deliveriesThisWeek: number;
  criticalAlerts: AlertRow[];
  alertCounts: { critico: number; atencao: number };
  stockCritical: number;
  setup: {
    epis: boolean;
    employees: boolean;
    stockEntry: boolean;
    delivery: boolean;
    team: boolean;
  };
};

/** Tudo o que o dashboard mostra, em paralelo. Nada de número inventado. */
export async function getDashboardData(
  orgId: string,
  userId: string,
  orgName: string,
): Promise<DashboardData> {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const head = { count: "exact" as const, head: true };

  const [
    members,
    audit,
    compliance,
    pending,
    weekDeliveries,
    alerts,
    epis,
    employees,
    entries,
    anyDelivery,
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
    supabase
      .from("v_employee_compliance")
      .select("status")
      .eq("organization_id", orgId),
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
  ]);

  const dist = { ok: 0, atencao: 0, irregular: 0, total: 0 };
  for (const r of compliance.data ?? []) {
    const s = r.status as "ok" | "atencao" | "irregular";
    if (s in dist) dist[s] += 1;
    dist.total += 1;
  }

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
    pendingSignatures: pending.count ?? 0,
    deliveriesThisWeek: weekDeliveries.count ?? 0,
    criticalAlerts: alerts.filter((a) => a.severity === "critico").slice(0, 6),
    alertCounts: {
      critico: alerts.filter((a) => a.severity === "critico").length,
      atencao: alerts.filter((a) => a.severity === "atencao").length,
    },
    stockCritical: alerts.filter((a) => a.kind === "estoque_minimo").length,
    setup: {
      epis: (epis.count ?? 0) > 0,
      employees: (employees.count ?? 0) > 0,
      stockEntry: (entries.count ?? 0) > 0,
      delivery: (anyDelivery.count ?? 0) > 0,
      team: (members.count ?? 1) > 1,
    },
  };
}
