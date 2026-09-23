import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = { label: string; done: boolean; soon?: boolean };

export function SetupChecklist({ memberCount }: { memberCount: number }) {
  const steps: Step[] = [
    { label: "Criar a organização", done: true },
    { label: "Convidar a equipe", done: memberCount > 1, soon: true },
    { label: "Cadastrar funcionários", done: false, soon: true },
    { label: "Cadastrar EPIs e estoque", done: false, soon: true },
    { label: "Registrar a primeira entrega", done: false, soon: true },
  ];
  const doneCount = steps.filter((s) => s.done).length;
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
          <li
            key={step.label}
            className="flex items-center gap-3 px-4 py-2.5 text-[15px]"
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
            {!step.done && step.soon && (
              <span className="text-muted-foreground text-xs">Em breve</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
