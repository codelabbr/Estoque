import type { Metadata } from "next";
import {
  Bell,
  Boxes,
  GraduationCap,
  HardHat,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { staggerStyle } from "@/lib/motion";

export const metadata: Metadata = { title: "Dashboard — Almox SST" };

const UPCOMING: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: HardHat,
    title: "Entregas de EPI",
    description: "Registro no balcão com assinatura do funcionário.",
  },
  {
    icon: Boxes,
    title: "Estoque",
    description: "Entradas, saldo por item e estoque mínimo.",
  },
  {
    icon: GraduationCap,
    title: "Treinamentos",
    description: "Validade das NRs e certificados por funcionário.",
  },
  {
    icon: Bell,
    title: "Alertas",
    description: "CA vencendo, reposição e treinamentos a vencer.",
  },
];

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  await params;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral de EPIs, estoque e treinamentos."
      />
      <EmptyState
        icon={LayoutDashboard}
        title="Seu painel está sendo preparado"
        description="Assim que os módulos abaixo forem liberados, você verá aqui a conformidade da equipe, o estoque crítico e os próximos vencimentos."
      />
      <section aria-labelledby="upcoming-title" className="space-y-3">
        <h2
          id="upcoming-title"
          className="text-muted-foreground animate-fade-up stagger text-sm font-medium"
          style={staggerStyle(2)}
        >
          Próximos módulos
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {UPCOMING.map(({ icon: Icon, title, description }, i) => (
            <li
              key={title}
              className="bg-card animate-fade-up stagger group rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              style={staggerStyle(3 + i)}
            >
              <div className="flex items-center justify-between">
                <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                  Em breve
                </span>
              </div>
              <p className="mt-3 text-sm font-medium">{title}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
