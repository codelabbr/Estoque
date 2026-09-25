export type AlertKind =
  | "treinamento_vencido"
  | "treinamento_pendente"
  | "treinamento_a_vencer"
  | "troca_epi_vencida"
  | "troca_epi_proxima"
  | "ca_vencido"
  | "ca_a_vencer"
  | "estoque_minimo"
  | "assinatura_pendente";

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  treinamento_vencido: "Treinamento vencido",
  treinamento_pendente: "Treinamento pendente",
  treinamento_a_vencer: "Treinamento a vencer",
  troca_epi_vencida: "Troca de EPI vencida",
  troca_epi_proxima: "Troca de EPI próxima",
  ca_vencido: "CA vencido",
  ca_a_vencer: "CA a vencer",
  estoque_minimo: "Estoque abaixo do mínimo",
  assinatura_pendente: "Assinatura pendente",
};

export const ALERT_GROUPS: {
  value: string;
  label: string;
  kinds: AlertKind[];
}[] = [
  { value: "todos", label: "Todos", kinds: [] },
  {
    value: "treinamentos",
    label: "Treinamentos",
    kinds: [
      "treinamento_vencido",
      "treinamento_pendente",
      "treinamento_a_vencer",
    ],
  },
  {
    value: "epis",
    label: "EPIs e CA",
    kinds: [
      "troca_epi_vencida",
      "troca_epi_proxima",
      "ca_vencido",
      "ca_a_vencer",
    ],
  },
  { value: "estoque", label: "Estoque", kinds: ["estoque_minimo"] },
  {
    value: "assinaturas",
    label: "Assinaturas",
    kinds: ["assinatura_pendente"],
  },
];

export type AlertRow = {
  alert_key: string;
  kind: AlertKind;
  severity: "critico" | "atencao" | "info";
  due_date: string | null;
  title: string;
  employee_id: string | null;
  epi_id: string | null;
  variant_id: string | null;
  delivery_id: string | null;
  training_type_id: string | null;
};

/** Ação principal de cada alerta (link dentro da organização). */
export function alertAction(
  a: AlertRow,
  orgSlug: string,
): { label: string; href: string } {
  const base = `/${orgSlug}`;
  switch (a.kind) {
    case "treinamento_vencido":
    case "treinamento_pendente":
    case "treinamento_a_vencer":
      return {
        label: "Registrar treinamento",
        href: `${base}/treinamentos/registrar?tipo=${a.training_type_id}&funcionario=${a.employee_id}`,
      };
    case "troca_epi_vencida":
    case "troca_epi_proxima":
      return {
        label: "Registrar entrega",
        href: `${base}/entregas/nova?funcionario=${a.employee_id}`,
      };
    case "ca_vencido":
    case "ca_a_vencer":
      return { label: "Atualizar CA", href: `${base}/epis/${a.epi_id}/editar` };
    case "estoque_minimo":
      return { label: "Repor estoque", href: `${base}/estoque/entrada` };
    case "assinatura_pendente":
      return {
        label: "Colher assinatura",
        href: `${base}/entregas/${a.delivery_id}`,
      };
  }
}
