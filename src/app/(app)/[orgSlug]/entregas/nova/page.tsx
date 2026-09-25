import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftRight, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { EmptyState } from "@/components/shared/empty-state";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { StatusBadge } from "@/components/shared/status-badge";
import { getOrgContext } from "@/lib/org";
import { canOperateStock, isOrgAdmin } from "@/lib/permissions";
import { todayInSaoPaulo } from "@/lib/format";
import { listEpiOptions } from "@/features/epis/queries";
import {
  getBalancesByVariant,
  resolveLocation,
} from "@/features/stock/queries";
import { getCounterContext } from "@/features/deliveries/queries";
import { getEmployeeTrainingStatus } from "@/features/trainings/queries";
import { EmployeePicker } from "@/features/deliveries/components/EmployeePicker";
import {
  DeliveryCart,
  type Suggestion,
} from "@/features/deliveries/components/DeliveryCart";

export const metadata: Metadata = { title: "Nova entrega — Almox SST" };

export default async function NewDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ funcionario?: string; local?: string }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const { org, role } = await getOrgContext(orgSlug);
  if (!canOperateStock(role)) redirect(`/${orgSlug}/entregas`);

  if (!sp.funcionario) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageHeader
          title="Nova entrega"
          description="Para quem são os EPIs?"
          backHref={`/${orgSlug}/entregas`}
        />
        <EmployeePicker orgSlug={orgSlug} />
      </div>
    );
  }

  const context = await getCounterContext(org.id, sp.funcionario);
  if (!context || context.employee.archived_at) notFound();
  const { employee } = context;

  if (employee.terminated_at) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageHeader
          title="Nova entrega"
          backHref={`/${orgSlug}/entregas/nova`}
        />
        <EmptyState
          icon={UserX}
          title={`${employee.full_name} está desligado`}
          description="Não é possível registrar entrega para funcionário desligado. Reative o cadastro se ele voltou."
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link href={`/${orgSlug}/funcionarios/${employee.id}`}>
                Ver cadastro
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { current } = await resolveLocation(org.id, sp.local);
  if (!current) notFound();
  const [epis, balances, trainings] = await Promise.all([
    listEpiOptions(org.id),
    getBalancesByVariant(org.id, current.id),
    getEmployeeTrainingStatus(org.id, employee.id),
  ]);
  const today = todayInSaoPaulo();

  // EPI que exige treinamento: aviso (não bloqueia) se o funcionário não tem o treinamento válido.
  const trainingStatus = new Map(
    trainings.map((t) => [t.training_type_id, t.status]),
  );
  const trainingWarnings: Record<string, string> = {};
  for (const e of epis) {
    if (!e.requiredTraining) continue;
    const status = trainingStatus.get(e.requiredTraining.id);
    if (status === "valido" || status === "a_vencer") continue;
    trainingWarnings[e.id] =
      status === "vencido"
        ? `${e.requiredTraining.name} vencido`
        : `${e.requiredTraining.name} nunca realizado`;
  }

  const activeEpiIds = new Set(epis.map((e) => e.id));
  const suggestions: Suggestion[] = [];
  // Obrigatórios primeiro: são os que tornam o funcionário irregular.
  const requirements = [...context.requirements].sort(
    (x, y) => Number(y.mandatory) - Number(x.mandatory),
  );
  for (const req of requirements) {
    if (
      !activeEpiIds.has(req.epi_id) ||
      context.everDeliveredEpiIds.includes(req.epi_id)
    )
      continue;
    suggestions.push({
      epiId: req.epi_id,
      variantId: context.lastVariantByEpi[req.epi_id] ?? null,
      reason: "primeira_entrega",
      quantity: req.quantity,
      why: req.mandatory
        ? "obrigatório do cargo, nunca entregue"
        : "recomendado para o cargo",
    });
  }
  const holdingsByEpi: Record<string, { nextReplacementAt: string | null }> =
    {};
  for (const h of context.holdings) {
    if (!h.epi_id) continue;
    holdingsByEpi[h.epi_id] = { nextReplacementAt: h.next_replacement_at };
    if (
      h.replacement_status === "vencida" &&
      activeEpiIds.has(h.epi_id) &&
      !suggestions.some((s) => s.epiId === h.epi_id)
    ) {
      suggestions.push({
        epiId: h.epi_id,
        variantId: h.variant_id,
        reason: "troca_vencimento",
        quantity: h.quantity ?? 1,
        why: "troca vencida",
      });
    }
  }
  const overdue = context.holdings.filter(
    (h) => h.replacement_status === "vencida",
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title="Nova entrega" backHref={`/${orgSlug}/entregas/nova`} />
      <Panel className="animate-fade-up">
        <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <AvatarInitials
            name={employee.full_name}
            className="size-12 text-base"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">
              {employee.full_name}
            </p>
            <p className="text-muted-foreground truncate text-sm">
              {[
                employee.job_roles?.name ?? "Sem cargo",
                employee.sectors?.name,
                employee.registration && `Mat. ${employee.registration}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link href={`/${orgSlug}/entregas/nova`}>
              <ArrowLeftRight /> Trocar
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-t px-4 py-3 sm:px-5">
          <StatusBadge
            status="pendente"
            label={`${context.holdings.length} ${context.holdings.length === 1 ? "item em posse" : "itens em posse"}`}
          />
          {overdue > 0 && (
            <StatusBadge
              status="irregular"
              label={`${overdue} ${overdue === 1 ? "troca vencida" : "trocas vencidas"}`}
            />
          )}
          {!employee.job_roles && (
            <StatusBadge
              status="atencao"
              label="Sem cargo: sem sugestões automáticas"
            />
          )}
        </div>
      </Panel>
      {epis.length === 0 ? (
        <EmptyState
          title="Nenhum EPI cadastrado"
          description="Cadastre EPIs e registre entradas de estoque antes de entregar."
          action={
            <Button asChild className="rounded-full font-bold">
              <Link href={`/${orgSlug}/epis/novo`}>Cadastrar EPI</Link>
            </Button>
          }
        />
      ) : (
        <DeliveryCart
          orgSlug={orgSlug}
          employeeId={employee.id}
          locationId={current.id}
          epis={epis.map((e) => ({
            id: e.id,
            name: e.name,
            caNumber: e.caNumber,
            caExpiresAt: e.caExpiresAt,
            variants: e.variants,
          }))}
          balances={balances}
          suggestions={suggestions}
          holdingsByEpi={holdingsByEpi}
          today={today}
          canOverrideCa={isOrgAdmin(role)}
          trainingWarnings={trainingWarnings}
        />
      )}
    </div>
  );
}
