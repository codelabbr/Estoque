type Stat = { label: string; value: string; hint: string };

/** Faixa de indicadores. Valores ainda sem módulo aparecem como "—", nunca como número inventado. */
export function StatStrip({ memberCount }: { memberCount: number }) {
  const stats: Stat[] = [
    {
      label: "Equipe",
      value: String(memberCount),
      hint: memberCount === 1 ? "usuário com acesso" : "usuários com acesso",
    },
    { label: "Funcionários", value: "—", hint: "após o cadastro" },
    { label: "Estoque crítico", value: "—", hint: "itens abaixo do mínimo" },
    { label: "Vencem em 30 dias", value: "—", hint: "CAs e treinamentos" },
  ];

  return (
    <dl className="grid grid-cols-2 border-b sm:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={[
            "px-4 py-4 sm:px-5",
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
        </div>
      ))}
    </dl>
  );
}
