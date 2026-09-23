import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  addDaysToDate,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  todayInSaoPaulo,
} from "@/lib/format";

import { ALERT_KIND_LABELS, type AlertKind } from "@/features/alerts/constants";
import {
  COMPLIANCE_STATUS,
  ISSUE_LABELS,
  TRAINING_STATUS,
  type TrainingStatus,
} from "@/features/trainings/constants";
import { MOVEMENT_LABELS } from "@/features/stock/constants";
import { getTrainingMatrix } from "@/features/trainings/queries";
import { getStockPosition, listLocations } from "@/features/stock/queries";

export type ReportColumnDef = {
  header: string;
  flex?: number;
  align?: "left" | "right" | "center";
};
export type Report = {
  title: string;
  subtitle?: string;
  landscape?: boolean;
  columns: ReportColumnDef[];
  rows: (string | number | null)[][];
  summary?: string[];
};

type Params = URLSearchParams;
type Builder = (orgId: string, params: Params) => Promise<Report>;

function period(params: Params) {
  const today = todayInSaoPaulo();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get("de") ?? "")
    ? params.get("de")!
    : addDaysToDate(today, -30);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.get("ate") ?? "")
    ? params.get("ate")!
    : today;
  return { from, to };
}

const conformidade: Builder = async (orgId, params) => {
  const supabase = await createClient();
  let q = supabase
    .from("v_employee_compliance")
    .select(
      "employee_id, employee_name, status, issues, job_role_id, sector_id",
    )
    .eq("organization_id", orgId);
  if (params.get("cargo")) q = q.eq("job_role_id", params.get("cargo")!);
  const [{ data }, roles, sectors] = await Promise.all([
    q,
    supabase.from("job_roles").select("id, name").eq("organization_id", orgId),
    supabase.from("sectors").select("id, name").eq("organization_id", orgId),
  ]);
  const roleName = new Map((roles.data ?? []).map((r) => [r.id, r.name]));
  const sectorName = new Map((sectors.data ?? []).map((r) => [r.id, r.name]));
  const rows = (data ?? []).sort((a, b) =>
    (a.employee_name ?? "").localeCompare(b.employee_name ?? "", "pt-BR"),
  );
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return {
    title: "Relatório de conformidade",
    subtitle: `Situação em ${formatDate(todayInSaoPaulo())}`,
    columns: [
      { header: "Funcionário", flex: 2 },
      { header: "Cargo", flex: 1.3 },
      { header: "Setor" },
      { header: "Situação" },
      { header: "Pendências", flex: 3 },
    ],
    rows: rows.map((r) => [
      r.employee_name,
      roleName.get(r.job_role_id ?? "") ?? "—",
      sectorName.get(r.sector_id ?? "") ?? "—",
      COMPLIANCE_STATUS[r.status ?? "ok"].label,
      (
        (r.issues ?? []) as {
          kind: string;
          label: string;
          due_date: string | null;
        }[]
      )
        .map(
          (i) =>
            `${ISSUE_LABELS[i.kind] ?? i.kind}: ${i.label}${i.due_date ? ` (${formatDate(i.due_date)})` : ""}`,
        )
        .join("; "),
    ]),
    summary: [
      `${rows.length} funcionários`,
      `${count("ok")} em dia`,
      `${count("atencao")} em atenção`,
      `${count("irregular")} irregulares`,
    ],
  };
};

const matrizTreinamentos: Builder = async (orgId, params) => {
  const { columns, rows } = await getTrainingMatrix(orgId, {
    jobRoleId: params.get("cargo") ?? undefined,
  });
  return {
    title: "Matriz de treinamentos",
    subtitle: `Situação em ${formatDate(todayInSaoPaulo())}`,
    landscape: true,
    columns: [
      { header: "Funcionário", flex: 2 },
      ...columns.map((c) => ({ header: c.name })),
    ],
    rows: rows.map((r) => [
      r.name,
      ...columns.map((c) => {
        const cell = r.cells[c.id];
        if (!cell || (cell.status === "pendente" && !cell.required)) return "";
        const label = TRAINING_STATUS[cell.status as TrainingStatus].label;
        return cell.expiresAt
          ? `${label} ${formatDate(cell.expiresAt)}`
          : label;
      }),
    ]),
  };
};

const vencimentos: Builder = async (orgId, params) => {
  const days = Math.min(Math.max(Number(params.get("dias")) || 30, 1), 365);
  const limit = addDaysToDate(todayInSaoPaulo(), days);
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_alerts")
    .select("kind, severity, due_date, title")
    .eq("organization_id", orgId)
    .not("due_date", "is", null)
    .lte("due_date", limit)
    .neq("kind", "assinatura_pendente");
  const rows = (data ?? []).sort((a, b) =>
    (a.due_date ?? "").localeCompare(b.due_date ?? ""),
  );
  return {
    title: "Vencimentos",
    subtitle: `Vencidos e a vencer até ${formatDate(limit)} (${days} dias)`,
    columns: [
      { header: "Vencimento" },
      { header: "Tipo", flex: 1.4 },
      { header: "Item", flex: 3 },
    ],
    rows: rows.map((r) => [
      formatDate(r.due_date!),
      ALERT_KIND_LABELS[r.kind as AlertKind] ?? r.kind,
      r.title,
    ]),
    summary: [`${rows.length} itens`],
  };
};

const estoque: Builder = async (orgId, params) => {
  const locations = await listLocations(orgId);
  const location =
    locations.find((l) => l.id === params.get("local")) ?? locations[0];
  const position = location ? await getStockPosition(orgId, location.id) : [];
  const rows = position.flatMap((p) =>
    p.variants.map((v) => ({
      epi: p.epiName,
      ca: p.caNumber,
      unit: p.unit,
      ...v,
      value: (v.avgCost ?? 0) * Math.max(v.balance, 0),
    })),
  );
  const total = rows.reduce((s, r) => s + r.value, 0);
  return {
    title: "Posição de estoque",
    subtitle: `${location?.name ?? ""} · ${formatDate(todayInSaoPaulo())}`,
    columns: [
      { header: "EPI", flex: 2.5 },
      { header: "CA" },
      { header: "Tamanho" },
      { header: "Saldo", align: "right" },
      { header: "Mínimo", align: "right" },
      { header: "Custo médio", align: "right" },
      { header: "Valor", align: "right" },
    ],
    rows: rows.map((r) => [
      r.epi,
      r.ca ?? "—",
      r.sizeLabel,
      formatNumber(r.balance),
      formatNumber(r.minStock),
      r.avgCost != null ? formatCurrency(r.avgCost) : "—",
      formatCurrency(r.value),
    ]),
    summary: [`${rows.length} itens`, `Valor total ${formatCurrency(total)}`],
  };
};

const movimentacoes: Builder = async (orgId, params) => {
  const { from, to } = period(params);
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_movements")
    .select(
      "occurred_on, created_at, type, signed_quantity, unit_cost, supplier, document_ref, reason, epi_variants(size_label, epis(name))",
    )
    .eq("organization_id", orgId)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("created_at", { ascending: true })
    .limit(10000);
  return {
    title: "Movimentações de estoque",
    subtitle: `${formatDate(from)} a ${formatDate(to)}`,
    landscape: true,
    columns: [
      { header: "Data" },
      { header: "Registro" },
      { header: "Tipo" },
      { header: "EPI", flex: 2 },
      { header: "Tam." },
      { header: "Qtd.", align: "right" },
      { header: "Custo un.", align: "right" },
      { header: "Fornecedor / doc.", flex: 1.5 },
      { header: "Motivo", flex: 1.5 },
    ],
    rows: (data ?? []).map((m) => [
      formatDate(m.occurred_on),
      formatDateTime(m.created_at),
      MOVEMENT_LABELS[m.type],
      m.epi_variants?.epis?.name ?? "",
      m.epi_variants?.size_label ?? "",
      m.signed_quantity,
      m.unit_cost != null ? formatCurrency(Number(m.unit_cost)) : "",
      [m.supplier, m.document_ref].filter(Boolean).join(" · "),
      m.reason ?? "",
    ]),
  };
};

/** Custo de EPI entregue no período, pelo custo médio vigente da variação. */
const custoEpi: Builder = async (orgId, params) => {
  const { from, to } = period(params);
  const supabase = await createClient();
  const [items, costs, sectors] = await Promise.all([
    supabase
      .from("epi_delivery_items")
      .select(
        "quantity, variant_id, epi_name_snapshot, epi_deliveries!inner(delivered_at, signature_status, employee_name_snapshot, employees(sector_id))",
      )
      .eq("organization_id", orgId)
      .neq("epi_deliveries.signature_status", "cancelada")
      .gte("epi_deliveries.delivered_at", `${from}T03:00:00Z`)
      .lte("epi_deliveries.delivered_at", `${addDaysToDate(to, 1)}T02:59:59Z`)
      .limit(20000),
    supabase
      .from("v_stock_balance")
      .select("variant_id, avg_cost")
      .eq("organization_id", orgId),
    supabase.from("sectors").select("id, name").eq("organization_id", orgId),
  ]);
  const cost = new Map<string, number>();
  for (const c of costs.data ?? [])
    if (c.avg_cost != null && c.variant_id)
      cost.set(c.variant_id, Number(c.avg_cost));
  const sectorName = new Map((sectors.data ?? []).map((s) => [s.id, s.name]));
  const bySector = new Map<
    string,
    { qty: number; value: number; missing: number }
  >();
  const byEmployee = new Map<
    string,
    { sector: string; qty: number; value: number }
  >();
  for (const i of items.data ?? []) {
    const sector =
      sectorName.get(i.epi_deliveries.employees?.sector_id ?? "") ??
      "Sem setor";
    const unit = cost.get(i.variant_id);
    const value = (unit ?? 0) * i.quantity;
    const s = bySector.get(sector) ?? { qty: 0, value: 0, missing: 0 };
    s.qty += i.quantity;
    s.value += value;
    if (unit === undefined) s.missing += i.quantity;
    bySector.set(sector, s);
    const name = i.epi_deliveries.employee_name_snapshot;
    const e = byEmployee.get(name) ?? { sector, qty: 0, value: 0 };
    e.qty += i.quantity;
    e.value += value;
    byEmployee.set(name, e);
  }
  const total = [...bySector.values()].reduce((s, x) => s + x.value, 0);
  const view = params.get("por") === "funcionario" ? "funcionario" : "setor";
  const rows =
    view === "setor"
      ? [...bySector.entries()]
          .sort((a, b) => b[1].value - a[1].value)
          .map(([sector, s]) => [
            sector,
            formatNumber(s.qty),
            formatCurrency(s.value),
            s.missing ? `${s.missing} un. sem custo` : "",
          ])
      : [...byEmployee.entries()]
          .sort((a, b) => b[1].value - a[1].value)
          .map(([name, e]) => [
            name,
            e.sector,
            formatNumber(e.qty),
            formatCurrency(e.value),
          ]);
  return {
    title: `Custo de EPI por ${view === "setor" ? "setor" : "funcionário"}`,
    subtitle: `${formatDate(from)} a ${formatDate(to)} · pelo custo médio das entradas`,
    columns:
      view === "setor"
        ? [
            { header: "Setor", flex: 2 },
            { header: "Itens", align: "right" },
            { header: "Custo", align: "right" },
            { header: "Observação", flex: 1.5 },
          ]
        : [
            { header: "Funcionário", flex: 2 },
            { header: "Setor", flex: 1.5 },
            { header: "Itens", align: "right" },
            { header: "Custo", align: "right" },
          ],
    rows,
    summary: [`Total ${formatCurrency(total)}`],
  };
};

export const REPORTS: Record<
  string,
  { build: Builder; formats: ("csv" | "pdf")[]; masksCpf?: boolean }
> = {
  conformidade: { build: conformidade, formats: ["pdf", "csv"] },
  "matriz-treinamentos": { build: matrizTreinamentos, formats: ["pdf", "csv"] },
  vencimentos: { build: vencimentos, formats: ["pdf", "csv"] },
  estoque: { build: estoque, formats: ["pdf", "csv"] },
  movimentacoes: { build: movimentacoes, formats: ["pdf", "csv"] },
  "custo-epi": { build: custoEpi, formats: ["pdf", "csv"] },
};
