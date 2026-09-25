import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { SectorRank } from "@/features/dashboard/compliance";

/** Distribuição da conformidade (barra empilhada com legenda) + ranking por setor. */
export function ComplianceCard({
  orgSlug,
  ok,
  atencao,
  irregular,
  total,
  ranking = [],
}: {
  orgSlug: string;
  ok: number;
  atencao: number;
  irregular: number;
  total: number;
  ranking?: SectorRank[];
}) {
  const parts = [
    {
      key: "ok",
      label: "Em dia",
      value: ok,
      icon: CheckCircle2,
      bar: "bg-status-ok-foreground",
      text: "text-status-ok-foreground",
    },
    {
      key: "atencao",
      label: "Em dia, com avisos",
      value: atencao,
      icon: Clock,
      bar: "bg-status-atencao-foreground",
      text: "text-status-atencao-foreground",
    },
    {
      key: "irregular",
      label: "Irregular",
      value: irregular,
      icon: AlertTriangle,
      bar: "bg-status-irregular-foreground",
      text: "text-status-irregular-foreground",
    },
  ];
  return (
    <section
      aria-labelledby="compliance-title"
      className="bg-muted/60 dark:bg-card overflow-hidden rounded-2xl border"
    >
      <div className="px-4 pt-3 pb-4">
        <h2
          id="compliance-title"
          className="text-xl font-extrabold tracking-tight"
        >
          Conformidade da equipe
        </h2>
        {total === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Aparece quando houver funcionários ativos.{" "}
            <Link
              href={`/${orgSlug}/funcionarios/novo`}
              className="text-primary hover:underline"
            >
              Cadastrar
            </Link>
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {total} funcionários ativos
            </p>
            <div
              className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label={`${ok} em dia, ${atencao} em atenção, ${irregular} irregulares`}
            >
              {parts
                .filter((p) => p.value > 0)
                .map((p) => (
                  <span
                    key={p.key}
                    className={`${p.bar} h-full`}
                    style={{ width: `${(p.value / total) * 100}%` }}
                  />
                ))}
            </div>
          </>
        )}
      </div>
      {total > 0 && (
        <ul>
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-3 px-4 py-2.5">
              <p.icon className={`size-4 ${p.text}`} aria-hidden="true" />
              <span className="flex-1 text-[15px]">{p.label}</span>
              <span className="font-bold tabular-nums">{p.value}</span>
              <span className="text-muted-foreground w-10 text-right text-sm tabular-nums">
                {Math.round((p.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
      {ranking.length > 1 && (
        <div className="border-t px-4 pt-3 pb-4">
          <h3 className="text-sm font-bold">Por setor</h3>
          <p className="text-muted-foreground text-xs">
            % em dia, do pior para o melhor
          </p>
          <ol className="mt-2 flex flex-col gap-2">
            {ranking.map((r) => (
              <li key={r.sector}>
                <div className="flex items-baseline justify-between gap-2 text-[15px]">
                  <span className="truncate">{r.sector}</span>
                  <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                    {r.emDia}/{r.total} ·{" "}
                    <strong className="text-foreground">{r.pct}%</strong>
                  </span>
                </div>
                <div
                  className="bg-border mt-1 h-1.5 overflow-hidden rounded-full"
                  role="img"
                  aria-label={`${r.sector}: ${r.pct}% em dia`}
                >
                  <div
                    className={
                      r.pct === 100
                        ? "bg-status-ok-foreground h-full"
                        : r.pct >= 50
                          ? "bg-status-atencao-foreground h-full"
                          : "bg-status-irregular-foreground h-full"
                    }
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
