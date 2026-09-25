import type { Metadata } from "next";
import { getOrgContext } from "@/lib/org";
import {
  canManageRegistry,
  canOperateStock,
  isOrgAdmin,
} from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { staggerStyle } from "@/lib/motion";
import { getDashboardData } from "@/features/dashboard/queries";
import { QuickComposer } from "@/features/dashboard/components/QuickComposer";
import { StatStrip } from "@/features/dashboard/components/StatStrip";
import { TodayList } from "@/features/dashboard/components/TodayList";
import { ActivityFeed } from "@/features/dashboard/components/ActivityFeed";
import { ComplianceCard } from "@/features/dashboard/components/ComplianceCard";
import { SetupChecklist } from "@/features/dashboard/components/SetupChecklist";
import { AlertRulesCard } from "@/features/dashboard/components/AlertRulesCard";

export const metadata: Metadata = { title: "Dashboard — Almox SST" };

function displayName(email: string) {
  const local = email.split("@")[0] ?? "";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org, role, user } = await getOrgContext(orgSlug);
  const data = await getDashboardData(org.id, orgSlug, user.id, org.name);
  const name = displayName(user.email);
  const initials = user.email.slice(0, 2).toUpperCase();
  const { compliance, summary } = data;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_350px] xl:gap-8">
      <div className="animate-fade-up overflow-clip rounded-2xl border">
        <header className="bg-background/80 sticky top-14 z-10 border-b px-4 py-3 backdrop-blur-xl sm:px-5">
          <h1 className="text-xl font-extrabold tracking-tight">
            {greeting()}, {name}
          </h1>
          <p className="text-muted-foreground text-[13px]">
            {org.name} · {data.deliveriesThisWeek}{" "}
            {data.deliveriesThisWeek === 1 ? "entrega" : "entregas"} nos últimos
            7 dias
          </p>
        </header>
        <QuickComposer
          orgSlug={orgSlug}
          initials={initials}
          canOperate={canOperateStock(role)}
          canManage={canManageRegistry(role)}
        />
        <StatStrip
          orgSlug={orgSlug}
          compliancePct={summary.pct}
          irregular={summary.irregular}
          pendingSignatures={data.pendingSignatures}
          stockCritical={data.stockCritical}
          casExpiring={data.casExpiring}
          trocasVencendo={summary.trocasVencendo}
          treinamentosVencendo={summary.treinamentosVencendo}
        />
        <TodayList
          orgSlug={orgSlug}
          actions={data.today}
          total={data.todayTotal}
        />
        <ActivityFeed
          entries={data.activity}
          userName={name}
          initials={initials}
        />
      </div>

      <aside
        className="animate-fade-up stagger flex flex-col gap-4 lg:sticky lg:top-20"
        style={staggerStyle(2)}
        aria-label="Resumo da organização"
      >
        <SetupChecklist
          orgSlug={orgSlug}
          setup={data.setup}
          canLoadDemo={isOrgAdmin(role)}
        />
        <ComplianceCard
          orgSlug={orgSlug}
          {...compliance}
          ranking={data.sectorRanking}
        />
        <AlertRulesCard
          days={{
            ca: org.alert_days_ca,
            epi: org.alert_days_epi,
            training: org.alert_days_training,
          }}
        />
        <p className="text-muted-foreground px-4 text-[13px] leading-relaxed">
          {org.name} · no Almox SST desde {formatDate(org.created_at)} · Dados
          tratados conforme a LGPD
        </p>
      </aside>
    </div>
  );
}
