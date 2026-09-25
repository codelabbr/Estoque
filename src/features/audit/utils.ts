import type { Json } from "@/lib/supabase/database.types";

/** Nome em pt-BR das entidades auditadas (tabela ou ação de RPC). */
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  employees: "Funcionário",
  epis: "EPI",
  epi_variants: "Tamanho de EPI",
  job_roles: "Cargo",
  job_role_epi_requirements: "Matriz de EPIs",
  job_role_training_requirements: "Matriz de treinamentos",
  sectors: "Setor",
  units: "Unidade",
  training_types: "Tipo de treinamento",
  employee_trainings: "Treinamento realizado",
  stock_locations: "Local de estoque",
  stock_movements: "Movimentação de estoque",
  epi_deliveries: "Entrega de EPI",
  epi_delivery_items: "Item de entrega",
  alert_states: "Alerta",
  alert_settings: "Configuração de alertas",
  organizations: "Organização",
  organization_members: "Membro da equipe",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  insert: "Criou",
  update: "Alterou",
  delete: "Excluiu",
  deliver_epis: "Registrou entrega",
  "deliver_epis:ca_vencido": "Liberou CA vencido",
  sign_delivery: "Assinatura registrada",
  cancel_delivery: "Cancelou entrega",
  return_epi: "Registrou devolução",
  register_stock_entry: "Entrada de estoque",
  adjust_stock: "Ajuste de estoque",
  discard_stock: "Descarte de estoque",
  apply_inventory: "Inventário",
  reverse_stock_movement: "Estorno de estoque",
  seed_demo_data: "Carregou dados de exemplo",
};

/** Filtros da tela de auditoria (grupos de tabelas). */
export const AUDIT_FILTERS: {
  value: string;
  label: string;
  tables: string[];
}[] = [
  { value: "todos", label: "Tudo", tables: [] },
  {
    value: "entregas",
    label: "Entregas",
    tables: ["epi_deliveries", "epi_delivery_items"],
  },
  { value: "estoque", label: "Estoque", tables: ["stock_movements"] },
  {
    value: "matriz",
    label: "Matriz",
    tables: ["job_role_epi_requirements", "job_role_training_requirements"],
  },
  { value: "funcionarios", label: "Funcionários", tables: ["employees"] },
  {
    value: "equipe",
    label: "Equipe e configurações",
    tables: ["organization_members", "organizations", "alert_settings"],
  },
];

const CPF_KEYS = new Set(["cpf", "employee_cpf_snapshot"]);

/** LGPD: CPF completo só no perfil e na ficha; na auditoria, mascarado. */
export function maskSensitive(
  data: Record<string, Json> | null,
): Record<string, Json> | null {
  if (!data) return data;
  const out: Record<string, Json> = {};
  for (const [k, v] of Object.entries(data)) {
    if (CPF_KEYS.has(k) && typeof v === "string") {
      const d = v.replace(/\D/g, "");
      out[k] =
        d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "***";
    } else out[k] = v;
  }
  return out;
}

/** Colunas técnicas que não interessam a quem lê a auditoria. */
const IGNORED = new Set([
  "updated_at",
  "created_at",
  "created_by",
  "updated_by",
]);

export type AuditChange = { field: string; before: Json; after: Json };

/** Campos que mudaram entre antes e depois (update), sem colunas técnicas. */
export function diffAudit(
  before: Record<string, Json> | null,
  after: Record<string, Json> | null,
): AuditChange[] {
  if (!before || !after) return [];
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: AuditChange[] = [];
  for (const field of fields) {
    if (IGNORED.has(field)) continue;
    const b = before[field] ?? null;
    const a = after[field] ?? null;
    if (JSON.stringify(b) !== JSON.stringify(a))
      out.push({ field, before: b, after: a });
  }
  return out.sort((x, y) => x.field.localeCompare(y.field));
}

/** Valor curto para exibir numa linha (JSON longo é resumido). */
export function formatAuditValue(value: Json): string {
  if (value === null) return "vazio";
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (typeof value === "string")
    return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  if (typeof value === "number") return String(value);
  const s = JSON.stringify(value);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}
