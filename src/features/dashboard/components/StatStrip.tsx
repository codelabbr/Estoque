import Link from "next/link";
import { formatNumber } from "@/lib/format";

type Stat = { label: string; value: string; hint: string; href: string };

export function StatStrip({
  orgSlug,
  compliancePct,
  irregular,
  pendingSignatures,
  stockCritical,
}: {
  orgSlug: string;
  compliancePct: number | null;
  irregular: number;
  pendingSignatures: number;
  stockCritical: number;
}) {
  const stats: Stat[] = [
    {
      label: "Conformidade",
      value: compliancePct === null ? "—" : `${compliancePct}%`,
      hint: "funcionários em dia",
      href: `/${orgSlug}/funcionarios`,
    },
    {
      label: "Irregulares",
      value: formatNumber(irregular),
      hint: "precisam de ação",
      href: `/${orgSlug}/alertas`,
    },
    {
      label: "Sem assinatura",
      value: formatNumber(pendingSignatures),
      hint: "entregas pendentes",
      href: `/${orgSlug}/entregas?filtro=pendentes`,
    },
    {
      label: "Estoque crítico",
      value: formatNumber(stockCritical),
      hint: "abaixo do mínimo",
      href: `/${orgSlug}/estoque?filtro=abaixo`,
    },
  ];

  return (
    <dl className="grid grid-cols-2 border-b sm:grid-cols-4">
      {stats.map((stat, i) => (
        <Link
          key={stat.label}
          href={stat.href}
          className={[
            "hover:bg-foreground/[0.03] px-4 py-4 transition-colors sm:px-5",
            i % 2 === 1 ? "border-l" : "",
            i >= 2 ? "border-t sm:border-t-0" : "",
            i === 2 ? "sm:border-l" : "",
          ].join(" ")}
        >
          <dt className="text-muted-foreground text-[13px]">{stat.label}</dt>
          <dd className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">
            {stat.value}
          </dd>
          <dd className="text-muted-foreground text-xs">{stat.hint}</dd>
        </Link>
      ))}
    </dl>
  );
}
