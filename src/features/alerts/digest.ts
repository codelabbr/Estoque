/**
 * Montagem do resumo diário por e-mail (funções puras, testáveis).
 * A rota /api/cron/daily-digest busca os dados e só envia.
 */
import type { DigestSection } from "@/emails/DailyDigest";
import { ALERT_KIND_LABELS, type AlertKind } from "./constants";

export type AlertSettings = {
  enabled: boolean;
  notify_new_irregulars: boolean;
  notify_ca: boolean;
  notify_replacements: boolean;
  notify_trainings: boolean;
  notify_stock: boolean;
  notify_signatures: boolean;
};

/** Sem linha em alert_settings = tudo ativado. */
export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: true,
  notify_new_irregulars: true,
  notify_ca: true,
  notify_replacements: true,
  notify_trainings: true,
  notify_stock: true,
  notify_signatures: true,
};

type ToggleKey = Exclude<keyof AlertSettings, "enabled">;

/** Um item de configuração = uma seção do e-mail. */
export const DIGEST_GROUPS: {
  key: ToggleKey;
  label: string;
  description: string;
  kinds: AlertKind[];
}[] = [
  {
    key: "notify_ca",
    label: "CA de EPI",
    description: "CAs vencidos ou vencendo",
    kinds: ["ca_vencido", "ca_a_vencer"],
  },
  {
    key: "notify_replacements",
    label: "Trocas de EPI",
    description: "Trocas vencidas ou vencendo",
    kinds: ["troca_epi_vencida", "troca_epi_proxima"],
  },
  {
    key: "notify_trainings",
    label: "Treinamentos",
    description: "Treinamentos vencidos, vencendo ou pendentes",
    kinds: [
      "treinamento_vencido",
      "treinamento_a_vencer",
      "treinamento_pendente",
    ],
  },
  {
    key: "notify_stock",
    label: "Estoque crítico",
    description: "Itens abaixo do estoque mínimo",
    kinds: ["estoque_minimo"],
  },
  {
    key: "notify_signatures",
    label: "Assinaturas pendentes",
    description: "Entregas esperando assinatura há mais de 24 h",
    kinds: ["assinatura_pendente"],
  },
];

/** Linha de v_alerts (colunas de view vêm como anuláveis nos tipos gerados). */
export type DigestAlert = {
  alert_key: string | null;
  kind: string | null;
  severity: string | null;
  due_date: string | null;
  title: string | null;
};

export type NewIrregular = { employeeId: string; name: string; reason: string };

/** Irregulares de hoje que não estavam irregulares na última foto. */
export function newIrregulars(
  today: { employeeId: string; name: string; reason: string }[],
  previousIds: string[] | null,
): NewIrregular[] {
  if (previousIds === null) return []; // primeira foto: vira a base, nada é "novo"
  const before = new Set(previousIds);
  return today.filter((e) => !before.has(e.employeeId));
}

const MAX_ITEMS = 10;

export function buildDigest(
  alerts: DigestAlert[],
  settings: AlertSettings,
  irregulars: NewIrregular[],
  describeDue: (date: string) => string,
): {
  sections: DigestSection[];
  criticalCount: number;
  attentionCount: number;
  /** Chaves que identificam o conteúdo (para não reenviar o mesmo e-mail). */
  contentKeys: string[];
} | null {
  if (!settings.enabled) return null;

  const sections: DigestSection[] = [];
  const keys: string[] = [];
  let critical = 0;
  let attention = 0;

  if (settings.notify_new_irregulars && irregulars.length > 0) {
    sections.push({
      label: "Irregulares novos",
      total: irregulars.length,
      items: irregulars.slice(0, MAX_ITEMS).map((e) => ({
        title: e.name,
        kindLabel: e.reason,
        due: null,
        critical: true,
      })),
    });
    critical += irregulars.length;
    keys.push(...irregulars.map((e) => `irregular:${e.employeeId}`));
  }

  for (const g of DIGEST_GROUPS) {
    if (!settings[g.key]) continue;
    const list = alerts
      .filter((a) => g.kinds.includes(a.kind as AlertKind))
      .sort(
        (a, b) =>
          Number(b.severity === "critico") - Number(a.severity === "critico"),
      );
    if (list.length === 0) continue;
    sections.push({
      label: g.label,
      total: list.length,
      items: list.slice(0, MAX_ITEMS).map((a) => ({
        title: a.title ?? "",
        kindLabel: ALERT_KIND_LABELS[a.kind as AlertKind] ?? a.kind ?? "",
        due: a.due_date ? describeDue(a.due_date) : null,
        critical: a.severity === "critico",
      })),
    });
    for (const a of list) {
      if (a.alert_key) keys.push(a.alert_key);
      if (a.severity === "critico") critical += 1;
      else attention += 1;
    }
  }

  if (sections.length === 0) return null;
  return {
    sections,
    criticalCount: critical,
    attentionCount: attention,
    contentKeys: keys.sort(),
  };
}

export function digestSubject(
  orgName: string,
  critical: number,
  attention: number,
) {
  return critical
    ? `${critical} ${critical === 1 ? "item crítico" : "itens críticos"} hoje · ${orgName}`
    : `${attention} ${attention === 1 ? "item pede" : "itens pedem"} atenção · ${orgName}`;
}
