import type { Metadata } from "next";
import {
  Boxes,
  CalendarClock,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  History,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { getOrgContext } from "@/lib/org";
import { addDaysToDate, todayInSaoPaulo } from "@/lib/format";

export const metadata: Metadata = { title: "Relatórios — Almox SST" };

type Param = {
  name: string;
  label: string;
  type: "date" | "number" | "select";
  defaultValue: string;
  options?: { value: string; label: string }[];
};

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await getOrgContext(orgSlug);
  const today = todayInSaoPaulo();
  const monthAgo = addDaysToDate(today, -30);
  const period: Param[] = [
    { name: "de", label: "De", type: "date", defaultValue: monthAgo },
    { name: "ate", label: "Até", type: "date", defaultValue: today },
  ];

  const reports: {
    slug: string;
    title: string;
    description: string;
    icon: typeof FileText;
    params?: Param[];
  }[] = [
    {
      slug: "conformidade",
      title: "Conformidade",
      description:
        "Situação de cada funcionário e o que está pendente. Para auditoria interna e fiscalização.",
      icon: ShieldCheck,
    },
    {
      slug: "vencimentos",
      title: "Vencimentos",
      description:
        "Treinamentos, trocas de EPI e CAs vencidos ou vencendo no período.",
      icon: CalendarClock,
      params: [
        {
          name: "dias",
          label: "Próximos (dias)",
          type: "number",
          defaultValue: "30",
        },
      ],
    },
    {
      slug: "matriz-treinamentos",
      title: "Matriz de treinamentos",
      description:
        "Funcionários × treinamentos com status e validade (paisagem).",
      icon: GraduationCap,
    },
    {
      slug: "estoque",
      title: "Posição de estoque",
      description:
        "Saldo, mínimo, custo médio e valor total por EPI e tamanho.",
      icon: Boxes,
    },
    {
      slug: "movimentacoes",
      title: "Movimentações",
      description:
        "Extrato de entradas, entregas, ajustes e estornos no período.",
      icon: History,
      params: period,
    },
    {
      slug: "custo-epi",
      title: "Custo de EPI",
      description:
        "Quanto foi entregue no período, pelo custo médio, por setor ou por funcionário.",
      icon: Wallet,
      params: [
        ...period,
        {
          name: "por",
          label: "Agrupar por",
          type: "select",
          defaultValue: "setor",
          options: [
            { value: "setor", label: "Setor" },
            { value: "funcionario", label: "Funcionário" },
          ],
        },
      ],
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description="PDF com código de verificação e CSV que abre direto no Excel."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((r, i) => (
          <Panel
            key={r.slug}
            className="animate-fade-up stagger flex flex-col"
            style={{ "--i": i } as React.CSSProperties}
          >
            <form
              method="get"
              target="_blank"
              className="flex flex-1 flex-col gap-4 p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                  <r.icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-extrabold">{r.title}</h2>
                  <p className="text-muted-foreground text-sm">
                    {r.description}
                  </p>
                </div>
              </div>
              {r.params && (
                <div className="grid grid-cols-2 gap-3">
                  {r.params.map((p) => (
                    <label key={p.name} className="text-sm">
                      <span className="text-muted-foreground mb-1 block text-xs">
                        {p.label}
                      </span>
                      {p.type === "select" ? (
                        <select
                          name={p.name}
                          defaultValue={p.defaultValue}
                          className="border-input bg-background h-10 w-full rounded-lg border px-3"
                        >
                          {p.options!.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          name={p.name}
                          type={p.type}
                          defaultValue={p.defaultValue}
                          min={p.type === "number" ? 1 : undefined}
                          max={p.type === "number" ? 365 : today}
                        />
                      )}
                    </label>
                  ))}
                </div>
              )}
              <div className="mt-auto flex gap-2">
                <Button
                  type="submit"
                  formAction={`/${orgSlug}/relatorios/${r.slug}.pdf`}
                  className="flex-1 rounded-full font-bold"
                >
                  <FileText /> PDF
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  formAction={`/${orgSlug}/relatorios/${r.slug}.csv`}
                  className="flex-1 rounded-full"
                >
                  <FileSpreadsheet /> CSV
                </Button>
              </div>
            </form>
          </Panel>
        ))}
      </div>
      <p className="text-muted-foreground text-center text-xs">
        A ficha de EPI de cada funcionário fica no perfil dele. Todo documento
        emitido é registrado com um código de verificação.
      </p>
    </div>
  );
}
