import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { AUDIT_FILTERS, maskSensitive } from "./utils";

export const AUDIT_PAGE_SIZE = 50;

export type AuditEntry = {
  id: number;
  action: string;
  tableName: string | null;
  actorId: string | null;
  createdAt: string;
  oldData: Record<string, Json> | null;
  newData: Record<string, Json> | null;
};

/** Trilha de auditoria da organização (RLS: só owner/admin leem). */
export async function listAuditLog(
  orgId: string,
  filter: string,
  page: number,
): Promise<{ rows: AuditEntry[]; hasMore: boolean }> {
  const supabase = await createClient();
  const tables = AUDIT_FILTERS.find((f) => f.value === filter)?.tables ?? [];
  let query = supabase
    .from("audit_log")
    .select("id, action, table_name, actor_id, created_at, old_data, new_data")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE); // +1 para saber se há mais
  if (tables.length) query = query.in("table_name", tables);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    tableName: r.table_name,
    actorId: r.actor_id,
    createdAt: r.created_at,
    // Mascara antes de sair do servidor: o CPF completo não chega ao navegador.
    oldData: maskSensitive(r.old_data as Record<string, Json> | null),
    newData: maskSensitive(r.new_data as Record<string, Json> | null),
  }));
  return {
    rows: rows.slice(0, AUDIT_PAGE_SIZE),
    hasMore: rows.length > AUDIT_PAGE_SIZE,
  };
}
