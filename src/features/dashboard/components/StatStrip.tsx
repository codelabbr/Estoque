import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

type Stat = {
  label: string;
  value: string;
  hint: string;
  href: string;
  /** Valor maior que zero pede ação: destaca em vermelho/âmbar. */
  tone?: "irregular" | "atencao";
};

export function StatStrip({
  orgSlug,
  compliancePct,
  irregular,
  pendingSignatures,
  stockCritical,
  casExpiring,
  trocasVencendo,
  treinamentosVencendo,
}: {
  orgSlug: string;
  compliancePct: number | null;
  irregular: number;
  pendingSignatures: number;
  stockCritical: number;
  casExpiring: number;
  trocasVencendo: number;
  treinamentosVencendo: number;
}) {
  const base = `/${orgSlug}`;
  const irregularHref = `${base}/funcionarios?filtro=irregulares`;
  const stats: Stat[] = [
    {
      label: "Irregulares",
      value: formatNumber(irregular),
      hint: "funcionários precisam de ação",
      href: irregularHref,
      tone: "irregular",
    },
    {
      label: "Sem assinatura",
      value: formatNumber(pendingSignatures),
      hint: "entregas pendentes",
      href: `${base}/entregas?filtro=pendentes`,
      tone: "irregular",
    },
    {
      label: "Estoque crítico",
      value: formatNumber(stockCritical),
      hint: "abaixo do mínimo",
      href: `${base}/estoque?filtro=abaixo`,
      tone: "atencao",
    },
    {
      label: "CAs vencendo",
      value: formatNumber(casExpiring),
      hint: "nos próximos 30 dias",
      href: `${base}/alertas?tipo=epis`,
      tone: "atencao",
    },
    {
      label: "Trocas vencendo",
      value: formatNumber(trocasVencendo),
      hint: "nos próximos 7 dias",
      href: `${base}/funcionarios?filtro=trocas`,
      tone: "atencao",
    },
    {
      label: "Treinamentos vencendo",
      value: formatNumber(treinamentosVencendo),
      hint: "nos próximos 30 dias",
      href: `${base}/treinamentos`,
      tone: "atencao",
    },
  ];

  return (
    <dl className="bg-border grid grid-cols-2 gap-px border-b sm:grid-cols-4">
      <Link
        href={irregularHref}
        className="bg-background hover:bg-muted/60 col-span-2 flex flex-col justify-center px-4 py-4 transition-colors sm:col-span-1 sm:row-span-2 sm:px-5"
      >
        <dt className="text-muted-foreground text-[13px]">Conformidade</dt>
        <dd className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums">
          {compliancePct === null ? "—" : `${compliancePct}%`}
        </dd>
        <dd className="text-muted-foreground text-xs">
          {compliancePct === null
            ? "cadastre funcionários para calcular"
            : "dos funcionários em dia · ver irregulares"}
        </dd>
      </Link>
      {stats.map((stat) => {
        const n = Number(stat.value.replace(/\D/g, ""));
        return (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-background hover:bg-muted/60 px-4 py-4 transition-colors sm:px-5"
          >
            <dt className="text-muted-foreground text-[13px]">{stat.label}</dt>
            <dd
              className={cn(
                "mt-1 text-2xl font-extrabold tracking-tight tabular-nums",
                n > 0 &&
                  stat.tone === "irregular" &&
                  "text-status-irregular-foreground",
                n > 0 &&
                  stat.tone === "atencao" &&
                  "text-status-atencao-foreground",
              )}
            >
              {stat.value}
            </dd>
            <dd className="text-muted-foreground text-xs">{stat.hint}</dd>
          </Link>
        );
      })}
    </dl>
  );
}
