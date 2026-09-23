import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { describeActivity, type ActivityEntry } from "./utils";

export type DashboardData = {
  user: { id: string; email: string };
  organization: Pick<
    Tables<"organizations">,
    | "id"
    | "name"
    | "created_at"
    | "alert_days_ca"
    | "alert_days_epi"
    | "alert_days_training"
  >;
  memberCount: number;
  activity: ActivityEntry[];
};

/** Dados reais disponíveis na Fase 0: organização, equipe e trilha de auditoria. */
export async function getDashboardData(
  orgSlug: string,
): Promise<DashboardData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: organization } = await supabase
    .from("organizations")
    .select(
      "id, name, created_at, alert_days_ca, alert_days_epi, alert_days_training",
    )
    .eq("slug", orgSlug)
    .single();
  if (!organization) return null;

  const [members, audit] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    // RLS: só owner/admin leem o audit_log; demais papéis recebem lista vazia.
    supabase
      .from("audit_log")
      .select("id, action, table_name, actor_id, created_at, new_data")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const activity = (audit.data ?? []).map((row) =>
    describeActivity(
      {
        id: row.id,
        action: row.action,
        tableName: row.table_name,
        actorId: row.actor_id,
        createdAt: row.created_at,
        newData: row.new_data as Record<string, Json> | null,
      },
      { currentUserId: user.id, organizationName: organization.name },
    ),
  );

  return {
    user: { id: user.id, email: user.email ?? "" },
    organization,
    memberCount: members.count ?? 1,
    activity,
  };
}
