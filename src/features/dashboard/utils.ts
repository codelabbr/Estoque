import type { Json } from "@/lib/supabase/database.types";
import { ROLE_LABELS as ORG_ROLE_LABELS } from "@/lib/permissions";

export const ROLE_LABELS: Record<string, string> = ORG_ROLE_LABELS;

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

const RPC_TEXT: Record<string, string> = {
  deliver_epis: "registrou uma entrega de EPI",
  "deliver_epis:ca_vencido": "entregou EPI com CA vencido (confirmado)",
  sign_delivery: "recebeu a assinatura de uma entrega",
  cancel_delivery: "cancelou uma entrega",
  return_epi: "registrou a devolução de um EPI",
  register_stock_entry: "registrou uma entrada de estoque",
  adjust_stock: "ajustou o saldo de estoque",
  discard_stock: "registrou um descarte de estoque",
  apply_inventory: "concluiu um inventário",
  reverse_stock_movement: "estornou uma movimentação de estoque",
};

const TABLE_NOUN: Record<string, string> = {
  employees: "um funcionário",
  epis: "um EPI",
  epi_variants: "um tamanho de EPI",
  job_roles: "um cargo",
  sectors: "um setor",
  units: "uma unidade",
  training_types: "um tipo de treinamento",
  employee_trainings: "um treinamento",
  stock_locations: "um local de estoque",
  alert_states: "um alerta",
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
  const name =
    typeof row.newData?.full_name === "string" ? row.newData.full_name : null;

  let text: string;
  if (RPC_TEXT[row.action]) {
    text = RPC_TEXT[row.action];
  } else if (row.tableName === "organizations") {
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
  } else if (row.tableName && TABLE_NOUN[row.tableName]) {
    const verb =
      row.action === "insert"
        ? "cadastrou"
        : row.action === "delete"
          ? "excluiu"
          : "atualizou";
    const noun =
      row.tableName === "employee_trainings" && row.action === "insert"
        ? "um treinamento realizado"
        : TABLE_NOUN[row.tableName];
    text = `${verb} ${noun}${name && row.tableName === "employees" ? ` (${name})` : ""}`;
  } else {
    text = "fez uma alteração";
  }

  return { id: row.id, actor, text, createdAt: row.createdAt };
}
