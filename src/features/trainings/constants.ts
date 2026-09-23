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

export const ISSUE_LABELS: Record<string, string> = {
  treinamento_pendente: "Treinamento pendente",
  treinamento_vencido: "Treinamento vencido",
  treinamento_a_vencer: "Treinamento a vencer",
  epi_nao_entregue: "EPI obrigatório não entregue",
  troca_epi_vencida: "Troca de EPI vencida",
  troca_epi_proxima: "Troca de EPI próxima",
};
