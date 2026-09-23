import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDashboardData } from "@/features/dashboard/queries";
import { QuickComposer } from "@/features/dashboard/components/QuickComposer";
import { StatStrip } from "@/features/dashboard/components/StatStrip";
import { ActivityFeed } from "@/features/dashboard/components/ActivityFeed";
import { SetupChecklist } from "@/features/dashboard/components/SetupChecklist";
import { AlertRulesCard } from "@/features/dashboard/components/AlertRulesCard";
import { formatDate } from "@/lib/format";

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
  const data = await getDashboardData(orgSlug);
  if (!data) notFound();

  const { user, organization, memberCount, activity } = data;
  const name = displayName(user.email);
  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_350px] xl:gap-8">
      <div className="animate-fade-up overflow-clip rounded-2xl border">
        <header className="bg-background/80 sticky top-14 z-10 border-b px-4 py-3 backdrop-blur-xl sm:px-5">
          <h1 className="text-xl font-extrabold tracking-tight">
            {greeting()}, {name}
          </h1>
          <p className="text-muted-foreground text-[13px]">
            {organization.name} · desde {formatDate(organization.created_at)}
          </p>
        </header>
        <QuickComposer initials={initials} />
        <StatStrip memberCount={memberCount} />
        <ActivityFeed entries={activity} userName={name} initials={initials} />
      </div>

      <aside
        className="animate-fade-up stagger flex flex-col gap-4 lg:sticky lg:top-20"
        style={{ "--i": 2 } as React.CSSProperties}
        aria-label="Resumo da organização"
      >
        <SetupChecklist memberCount={memberCount} />
        <AlertRulesCard
          days={{
            ca: organization.alert_days_ca,
            epi: organization.alert_days_epi,
            training: organization.alert_days_training,
          }}
        />
        <p className="text-muted-foreground px-4 text-[13px] leading-relaxed">
          Almox SST · Dados tratados conforme a LGPD · ©{" "}
          {new Date().getFullYear()}
        </p>
      </aside>
    </div>
  );
}
