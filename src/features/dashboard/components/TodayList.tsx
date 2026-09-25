import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodayAction } from "@/features/dashboard/compliance";

/** "O que fazer hoje": pendências que tornam alguém irregular, cada uma com a ação que resolve. */
export function TodayList({
  orgSlug,
  actions,
  total,
}: {
  orgSlug: string;
  actions: TodayAction[];
  total: number;
}) {
  return (
    <section aria-labelledby="today-title" className="border-b">
      <div className="flex items-baseline justify-between border-b px-4 py-3 sm:px-5">
        <h2 id="today-title" className="text-xl font-extrabold tracking-tight">
          O que fazer hoje
        </h2>
        {total > actions.length && (
          <Link
            href={`/${orgSlug}/funcionarios?filtro=irregulares`}
            className="text-primary text-sm font-medium hover:underline"
          >
            Ver todos ({total})
          </Link>
        )}
      </div>
      {actions.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-6 sm:px-5">
          <CheckCircle2 className="text-status-ok-foreground size-6 shrink-0" />
          <p className="text-[15px]">
            <strong>Nada pendente.</strong>{" "}
            <span className="text-muted-foreground">
              Todos os funcionários estão em dia e o estoque está acima do
              mínimo.
            </span>
          </p>
        </div>
      ) : (
        <ul>
          {actions.map((a) => (
            <li
              key={a.key}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  a.severity === "critico"
                    ? "bg-status-irregular text-status-irregular-foreground"
                    : "bg-status-atencao text-status-atencao-foreground",
                )}
              >
                <AlertTriangle className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{a.title}</p>
                <p className="text-muted-foreground truncate text-sm">
                  {a.detail}
                </p>
              </div>
              <Link
                href={a.action.href}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-9 shrink-0 items-center rounded-full px-4 text-sm font-bold transition-colors"
              >
                {a.action.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
