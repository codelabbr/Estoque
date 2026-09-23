import { Boxes, GraduationCap, HardHat, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { icon: HardHat, label: "Entrega de EPI" },
  { icon: Boxes, label: "Entrada no estoque" },
  { icon: GraduationCap, label: "Treinamento" },
  { icon: UserPlus, label: "Funcionário" },
];

/** Atalho de registro no topo do feed. As ações liberam conforme os módulos das próximas fases. */
export function QuickComposer({ initials }: { initials: string }) {
  return (
    <div className="flex gap-3 border-b px-4 py-4 sm:px-5">
      <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground py-2 text-lg sm:text-xl">
          O que você precisa registrar hoje?
        </p>
        <div className="mt-2 flex items-center justify-between gap-3 border-t pt-3">
          <ul className="-ml-2 flex items-center">
            {ACTIONS.map(({ icon: Icon, label }) => (
              <li key={label}>
                <span
                  title={`${label} — em breve`}
                  className="text-primary/60 flex size-9 items-center justify-center rounded-full"
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  <span className="sr-only">{label} (em breve)</span>
                </span>
              </li>
            ))}
          </ul>
          <Button
            disabled
            className="rounded-full px-5 font-bold"
            title="Disponível na Fase 3"
          >
            Registrar
          </Button>
        </div>
      </div>
    </div>
  );
}
