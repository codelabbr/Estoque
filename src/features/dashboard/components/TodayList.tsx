import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { describeDue } from "@/lib/format";
import {
  ALERT_KIND_LABELS,
  alertAction,
  type AlertRow,
} from "@/features/alerts/constants";

export function TodayList({
  orgSlug,
  alerts,
  totalCritical,
  totalAttention,
}: {
  orgSlug: string;
  alerts: AlertRow[];
  totalCritical: number;
  totalAttention: number;
}) {
  return (
    <section aria-labelledby="today-title" className="border-b">
      <div className="flex items-baseline justify-between border-b px-4 py-3 sm:px-5">
        <h2 id="today-title" className="text-xl font-extrabold tracking-tight">
          O que fazer hoje
        </h2>
        {(totalCritical > 0 || totalAttention > 0) && (
          <Link
            href={`/${orgSlug}/alertas`}
            className="text-primary text-sm font-medium hover:underline"
          >
            Ver {totalCritical + totalAttention} alertas
          </Link>
        )}
      </div>
      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-6 sm:px-5">
          <CheckCircle2 className="text-status-ok-foreground size-6 shrink-0" />
          <p className="text-[15px]">
            <strong>Nada crítico.</strong>{" "}
            <span className="text-muted-foreground">
              {totalAttention > 0
                ? `${totalAttention} ${totalAttention === 1 ? "item pede" : "itens pedem"} atenção nos próximos dias.`
                : "Tudo em dia por aqui."}
            </span>
          </p>
        </div>
      ) : (
        <ul>
          {alerts.map((a) => {
            const action = alertAction(a, orgSlug);
            return (
              <li key={a.alert_key} className="border-b last:border-b-0">
                <Link
                  href={action.href}
                  className="hover:bg-foreground/[0.03] flex items-center gap-3 px-4 py-3 transition-colors sm:px-5"
                >
                  <span className="bg-status-irregular text-status-irregular-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
                    <AlertTriangle className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{a.title}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {ALERT_KIND_LABELS[a.kind]}
                      {a.due_date && ` · ${describeDue(a.due_date)}`} ·{" "}
                      <span className="text-primary">{action.label}</span>
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
