import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Dashboard — Almox SST" };

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  await params;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral de EPIs, estoque e treinamentos."
      />
      <EmptyState
        icon={LayoutDashboard}
        title="O dashboard chega na Fase 5"
        description="Cadastros, estoque, entregas e treinamentos serão adicionados nas próximas fases, seguindo o roadmap."
      />
    </div>
  );
}
