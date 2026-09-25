import type { Status } from "@/components/shared/status-badge";

export type TrainingStatus = "valido" | "a_vencer" | "vencido" | "pendente";

export const TRAINING_STATUS: Record<
  TrainingStatus,
  { label: string; status: Status }
> = {
  valido: { label: "Válido", status: "ok" },
  a_vencer: { label: "A vencer", status: "atencao" },
  vencido: { label: "Vencido", status: "irregular" },
  pendente: { label: "Pendente", status: "pendente" },
};

export const COMPLIANCE_STATUS: Record<
  string,
  { label: string; status: Status }
> = {
  ok: { label: "Em dia", status: "ok" },
  atencao: { label: "Atenção", status: "atencao" },
  irregular: { label: "Irregular", status: "irregular" },
};

/** Tipos de pendência do motor de conformidade (v_compliance_issues). */
export const ISSUE_LABELS: Record<string, string> = {
  epi_obrigatorio_nunca_entregue: "EPI obrigatório nunca entregue",
  troca_vencida: "Troca de EPI vencida",
  troca_vencendo: "Troca de EPI vence em até 7 dias",
  ca_vencido_em_uso: "EPI em uso com CA vencido",
  entrega_sem_assinatura: "Entrega sem assinatura",
  treinamento_nunca_realizado: "Treinamento obrigatório nunca realizado",
  treinamento_vencido: "Treinamento vencido",
  treinamento_vencendo: "Treinamento vence em breve",
};
