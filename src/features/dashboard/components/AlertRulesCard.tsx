import { BellRing } from "lucide-react";

/** Antecedência dos alertas, lida da organização (editável em Configurações numa fase futura). */
export function AlertRulesCard({
  days,
}: {
  days: { ca: number; epi: number; training: number };
}) {
  const rules = [
    { topic: "Certificado de Aprovação", label: "CA de EPI", value: days.ca },
    { topic: "Validade", label: "EPI entregue", value: days.epi },
    { topic: "NRs", label: "Treinamentos", value: days.training },
  ];

  return (
    <section
      aria-labelledby="alerts-title"
      className="bg-muted/60 dark:bg-card overflow-hidden rounded-2xl border"
    >
      <h2
        id="alerts-title"
        className="flex items-center gap-2 px-4 pt-3 pb-2 text-xl font-extrabold tracking-tight"
      >
        Regras de alerta
      </h2>
      <ul>
        {rules.map((rule) => (
          <li
            key={rule.label}
            className="hover:bg-foreground/[0.03] flex items-center gap-3 px-4 py-3 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-[13px]">{rule.topic}</p>
              <p className="font-bold">{rule.label}</p>
              <p className="text-muted-foreground text-[13px]">
                Aviso {rule.value} dias antes do vencimento
              </p>
            </div>
            <BellRing
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden="true"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
