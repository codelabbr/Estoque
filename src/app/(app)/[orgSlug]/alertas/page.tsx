import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BellOff, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { describeDue } from "@/lib/format";
import { listAlerts } from "@/features/alerts/queries";
import {
  ALERT_GROUPS,
  ALERT_KIND_LABELS,
  alertAction,
  type AlertRow,
} from "@/features/alerts/constants";
import { AlertRowActions } from "@/features/alerts/components/AlertRowActions";
import { DigestToggle } from "@/features/alerts/components/DigestToggle";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Alertas — Almox SST" };

export default async function AlertsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { orgSlug } = await params;
  const { tipo } = await searchParams;
  const { org, role, user } = await getOrgContext(orgSlug);
  const group = ALERT_GROUPS.find((g) => g.value === tipo) ?? ALERT_GROUPS[0];
  const all = await listAlerts(org.id);
  const alerts = group.kinds.length
    ? all.filter((a) => group.kinds.includes(a.kind))
    : all;
  const critical = alerts.filter((a) => a.severity === "critico");
  const attention = alerts.filter((a) => a.severity !== "critico");
  const canAct = canManageRegistry(role);
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("daily_digest")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const receivesDigest =
    role === "owner" || role === "admin" || role === "safety";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Alertas"
        description="O que precisa de ação para manter a empresa em dia."
      />
      <Panel className="animate-fade-up">
        <FilterTabs
          items={ALERT_GROUPS.map((g) => ({
            value: g.value,
            label: g.label,
            count: g.kinds.length
              ? all.filter((a) => g.kinds.includes(a.kind)).length
              : all.length,
          }))}
          current={group.value}
          hrefFor={(v) =>
            `/${orgSlug}/alertas${v === "todos" ? "" : `?tipo=${v}`}`
          }
        />
        {alerts.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            className="rounded-none border-0"
            title="Tudo em dia"
            description="Nenhum alerta aberto neste filtro. Alertas adiados voltam na data escolhida."
          />
        )}
      </Panel>

      {critical.length > 0 && (
        <AlertSection
          title="Críticos"
          icon={AlertTriangle}
          tone="text-status-irregular-foreground"
          alerts={critical}
          orgSlug={orgSlug}
          canAct={canAct}
        />
      )}
      {attention.length > 0 && (
        <AlertSection
          title="Atenção"
          icon={Clock}
          tone="text-status-atencao-foreground"
          alerts={attention}
          orgSlug={orgSlug}
          canAct={canAct}
        />
      )}
      {receivesDigest ? (
        <Panel>
          <DigestToggle
            orgSlug={orgSlug}
            enabled={membership?.daily_digest ?? true}
          />
        </Panel>
      ) : (
        <p className="text-muted-foreground flex items-center justify-center gap-2 text-center text-xs">
          <BellOff className="size-3.5" /> O resumo diário por e-mail vai para
          proprietários, administradores e segurança do trabalho.
        </p>
      )}
    </div>
  );
}

function AlertSection({
  title,
  icon: Icon,
  tone,
  alerts,
  orgSlug,
  canAct,
}: {
  title: string;
  icon: typeof AlertTriangle;
  tone: string;
  alerts: AlertRow[];
  orgSlug: string;
  canAct: boolean;
}) {
  return (
    <Panel className="animate-fade-up">
      <PanelHeader
        title={`${title} · ${alerts.length}`}
        actions={<Icon className={`size-5 ${tone}`} aria-hidden="true" />}
      />
      <ul>
        {alerts.map((a) => {
          const action = alertAction(a, orgSlug);
          return (
            <li
              key={a.alert_key}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
            >
              <Icon className={`size-5 shrink-0 ${tone}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{a.title}</p>
                <p className="text-muted-foreground truncate text-sm">
                  {ALERT_KIND_LABELS[a.kind]}
                  {a.due_date && ` · ${describeDue(a.due_date)}`}
                </p>
              </div>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="hidden rounded-full sm:inline-flex"
              >
                <Link href={action.href}>{action.label}</Link>
              </Button>
              {canAct && (
                <AlertRowActions orgSlug={orgSlug} alertKey={a.alert_key} />
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
