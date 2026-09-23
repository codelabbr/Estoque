import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AlertKind, AlertRow } from "./constants";

const SEVERITY_ORDER = { critico: 0, atencao: 1, info: 2 } as const;

export async function listAlerts(orgId: string, kinds: AlertKind[] = []) {
  const supabase = await createClient();
  let query = supabase
    .from("v_alerts")
    .select(
      "alert_key, kind, severity, due_date, title, employee_id, epi_id, variant_id, delivery_id, training_type_id",
    )
    .eq("organization_id", orgId)
    .limit(1000);
  if (kinds.length) query = query.in("kind", kinds);
  const { data, error } = await query;
  if (error) throw error;
  return (data as AlertRow[]).sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      a.title.localeCompare(b.title, "pt-BR"),
  );
}

export async function countAlerts(orgId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("v_alerts")
    .select("alert_key", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .in("severity", ["critico", "atencao"]);
  return count ?? 0;
}
