import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadDemoButton } from "./LoadDemoButton";

type Step = { label: string; done: boolean; href: string };

export function SetupChecklist({
  orgSlug,
  setup,
  canLoadDemo = false,
}: {
  orgSlug: string;
  canLoadDemo?: boolean;
  setup: {
    epis: boolean;
    employees: boolean;
    stockEntry: boolean;
    delivery: boolean;
    team: boolean;
  };
}) {
  const steps: Step[] = [
    {
      label: "Criar a organização",
      done: true,
      href: `/${orgSlug}/configuracoes`,
    },
    {
      label: "Cadastrar EPIs",
      done: setup.epis,
      href: `/${orgSlug}/epis/novo`,
    },
    {
      label: "Cadastrar funcionários",
      done: setup.employees,
      href: `/${orgSlug}/funcionarios/importar`,
    },
    {
      label: "Registrar entrada de estoque",
      done: setup.stockEntry,
      href: `/${orgSlug}/estoque/entrada`,
    },
    {
      label: "Registrar a primeira entrega",
      done: setup.delivery,
      href: `/${orgSlug}/entregas/nova`,
    },
    {
      label: "Convidar a equipe",
      done: setup.team,
      href: `/${orgSlug}/configuracoes?aba=equipe`,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const percent = Math.round((doneCount / steps.length) * 100);

  return (
    <section
      aria-labelledby="setup-title"
      className="bg-muted/60 dark:bg-card overflow-hidden rounded-2xl border"
    >
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-baseline justify-between">
          <h2
            id="setup-title"
            className="text-xl font-extrabold tracking-tight"
          >
            Primeiros passos
          </h2>
          <span className="text-muted-foreground text-sm tabular-nums">
            {doneCount}/{steps.length}
          </span>
        </div>
        <div
          className="bg-border mt-3 h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso da configuração"
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <ol>
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className={cn(
                "hover:bg-foreground/[0.03] flex items-center gap-3 px-4 py-2.5 text-[15px] transition-colors",
                step.done && "pointer-events-none",
              )}
              aria-disabled={step.done}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  step.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {step.done && (
                  <Check
                    className="size-3.5"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span
                className={cn(
                  "flex-1",
                  step.done && "text-muted-foreground line-through",
                )}
              >
                {step.label}
                <span className="sr-only">
                  {step.done ? " (concluído)" : " (pendente)"}
                </span>
              </span>
              {!step.done && (
                <ChevronRight className="text-muted-foreground size-4" />
              )}
            </Link>
          </li>
        ))}
      </ol>
      {canLoadDemo && !setup.employees && <LoadDemoButton orgSlug={orgSlug} />}
    </section>
  );
}
