import type { Json } from "@/lib/supabase/database.types";

export const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  safety: "Segurança do trabalho",
  storekeeper: "Almoxarife",
  viewer: "Somente leitura",
};

export type AuditRow = {
  id: number;
  action: string;
  tableName: string | null;
  actorId: string | null;
  createdAt: string;
  newData: Record<string, Json> | null;
};

export type ActivityEntry = {
  id: number;
  actor: "me" | "other" | "system";
  text: string;
  createdAt: string;
};

/** Transforma uma linha do audit_log em uma frase curta para o feed do dashboard. */
export function describeActivity(
  row: AuditRow,
  ctx: { currentUserId: string; organizationName: string },
): ActivityEntry {
  const actor: ActivityEntry["actor"] = !row.actorId
    ? "system"
    : row.actorId === ctx.currentUserId
      ? "me"
      : "other";
  const role =
    typeof row.newData?.role === "string"
      ? (ROLE_LABELS[row.newData.role] ?? row.newData.role)
      : null;
  const memberIsActor =
    typeof row.newData?.user_id === "string" &&
    row.newData.user_id === row.actorId;

  let text: string;
  if (row.tableName === "organizations") {
    text =
      row.action === "insert"
        ? `criou a organização ${ctx.organizationName}`
        : "atualizou os dados da organização";
  } else if (row.tableName === "organization_members") {
    if (row.action === "insert") {
      text = memberIsActor
        ? `entrou na equipe como ${role ?? "membro"}`
        : `adicionou um membro como ${role ?? "membro"}`;
    } else if (row.action === "update") {
      text = `alterou o papel de um membro${role ? ` para ${role}` : ""}`;
    } else {
      text = "removeu um membro da equipe";
    }
  } else {
    text = "fez uma alteração";
  }

  return { id: row.id, actor, text, createdAt: row.createdAt };
}
