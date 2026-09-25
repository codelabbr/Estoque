/**
 * Regras do dashboard orientado a risco, a partir do motor de conformidade
 * (fn_conformidade_funcionarios). Funções puras: sem banco, testáveis.
 */

export type PendenciaTipo =
  | "epi_obrigatorio_nunca_entregue"
  | "troca_vencida"
  | "troca_vencendo"
  | "ca_vencido_em_uso"
  | "entrega_sem_assinatura"
  | "treinamento_nunca_realizado"
  | "treinamento_vencido"
  | "treinamento_vencendo";

export type Pendencia = {
  tipo: PendenciaTipo;
  severidade: "irregular" | "aviso";
  item: string;
  item_id: string | null;
  data_referencia: string | null;
};

export type ComplianceRow = {
  employeeId: string;
  employeeName: string;
  sectorName: string | null;
  status: "em_dia" | "irregular";
  pendencias: Pendencia[];
};

export type ComplianceSummary = {
  total: number;
  emDia: number;
  irregular: number;
  /** % de funcionários em dia; null quando não há funcionários ativos. */
  pct: number | null;
  trocasVencendo: number;
  treinamentosVencendo: number;
};

export function summarize(rows: ComplianceRow[]): ComplianceSummary {
  const emDia = rows.filter((r) => r.status === "em_dia").length;
  const count = (tipo: PendenciaTipo) =>
    rows.reduce(
      (n, r) => n + r.pendencias.filter((p) => p.tipo === tipo).length,
      0,
    );
  return {
    total: rows.length,
    emDia,
    irregular: rows.length - emDia,
    pct: rows.length ? Math.round((emDia / rows.length) * 100) : null,
    trocasVencendo: count("troca_vencendo"),
    treinamentosVencendo: count("treinamento_vencendo"),
  };
}

export type SectorRank = {
  sector: string;
  total: number;
  emDia: number;
  pct: number;
};

/** Ranking de conformidade por setor: pior primeiro (onde agir). */
export function rankBySector(rows: ComplianceRow[]): SectorRank[] {
  const bySector = new Map<string, { total: number; emDia: number }>();
  for (const r of rows) {
    const key = r.sectorName ?? "Sem setor";
    const acc = bySector.get(key) ?? { total: 0, emDia: 0 };
    acc.total += 1;
    if (r.status === "em_dia") acc.emDia += 1;
    bySector.set(key, acc);
  }
  return [...bySector.entries()]
    .map(([sector, v]) => ({
      sector,
      ...v,
      pct: Math.round((v.emDia / v.total) * 100),
    }))
    .sort(
      (a, b) =>
        a.pct - b.pct || b.total - a.total || a.sector.localeCompare(b.sector),
    );
}

export type TodayAction = {
  key: string;
  title: string;
  detail: string;
  severity: "critico" | "atencao";
  action: { label: string; href: string };
};

const EPI_TIPOS: PendenciaTipo[] = [
  "epi_obrigatorio_nunca_entregue",
  "troca_vencida",
  "ca_vencido_em_uso",
];
const TRAINING_TIPOS: PendenciaTipo[] = [
  "treinamento_nunca_realizado",
  "treinamento_vencido",
];

const EPI_DETAIL: Partial<Record<PendenciaTipo, string>> = {
  epi_obrigatorio_nunca_entregue: "nunca entregue",
  troca_vencida: "troca vencida",
  ca_vencido_em_uso: "CA vencido em uso",
};

/**
 * "O que fazer hoje": uma linha por funcionário e ação (Entregar, Coletar
 * assinatura, Agendar treinamento), só com pendências que tornam irregular.
 */
export function todayActions(
  rows: ComplianceRow[],
  orgSlug: string,
): TodayAction[] {
  const base = `/${orgSlug}`;
  const out: TodayAction[] = [];
  for (const r of rows) {
    const irregular = r.pendencias.filter((p) => p.severidade === "irregular");
    if (irregular.length === 0) continue;

    const epis = irregular.filter((p) => EPI_TIPOS.includes(p.tipo));
    if (epis.length > 0) {
      out.push({
        key: `entregar:${r.employeeId}`,
        title: r.employeeName,
        detail: epis.map((p) => `${p.item} (${EPI_DETAIL[p.tipo]})`).join(", "),
        severity: "critico",
        action: {
          label: "Entregar",
          href: `${base}/entregas/nova?funcionario=${r.employeeId}`,
        },
      });
    }

    for (const p of irregular.filter(
      (x) => x.tipo === "entrega_sem_assinatura",
    )) {
      out.push({
        key: `assinar:${p.item_id}`,
        title: r.employeeName,
        detail: `${p.item} sem assinatura`,
        severity: "critico",
        action: {
          label: "Coletar assinatura",
          href: `${base}/entregas/${p.item_id}`,
        },
      });
    }

    for (const p of irregular.filter((x) => TRAINING_TIPOS.includes(x.tipo))) {
      out.push({
        key: `treinar:${r.employeeId}:${p.item_id}`,
        title: r.employeeName,
        detail: `${p.item} ${p.tipo === "treinamento_vencido" ? "vencido" : "nunca realizado"}`,
        severity: "critico",
        action: {
          label: "Agendar treinamento",
          href: `${base}/treinamentos/registrar?tipo=${p.item_id}&funcionario=${r.employeeId}`,
        },
      });
    }
  }
  return out;
}
