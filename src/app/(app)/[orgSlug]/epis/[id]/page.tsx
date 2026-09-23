import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DetailList, Panel, PanelHeader } from "@/components/shared/panel";
import { CaBadge } from "@/components/shared/ca-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { formatCurrency, formatDate } from "@/lib/format";
import { getEpi } from "@/features/epis/queries";
import { EPI_CATEGORY_LABELS } from "@/features/epis/constants";
import { setEpiArchived } from "@/features/epis/actions";
import { VariantsPanel } from "@/features/epis/components/VariantsPanel";

export const metadata: Metadata = { title: "EPI — Almox SST" };

export default async function EpiDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  const { org, role } = await getOrgContext(orgSlug);
  const epi = await getEpi(org.id, id);
  if (!epi) notFound();
  const canEdit = canManageRegistry(role);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title={epi.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {EPI_CATEGORY_LABELS[epi.category]}
            {epi.archived_at && (
              <StatusBadge status="pendente" label="Arquivado" />
            )}
          </span>
        }
        backHref={`/${orgSlug}/epis`}
        actions={
          canEdit && (
            <>
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/${orgSlug}/epis/${id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" className="rounded-full">
                    {epi.archived_at ? <ArchiveRestore /> : <Archive />}
                    {epi.archived_at ? "Reativar" : "Arquivar"}
                  </Button>
                }
                title={
                  epi.archived_at ? "Reativar este EPI?" : "Arquivar este EPI?"
                }
                description={
                  epi.archived_at
                    ? "Ele volta a aparecer em entradas de estoque e entregas."
                    : "Ele deixa de aparecer em entradas e entregas. Entregas e movimentações já registradas continuam no histórico."
                }
                confirmLabel={epi.archived_at ? "Reativar" : "Arquivar"}
                successMessage={
                  epi.archived_at ? "EPI reativado" : "EPI arquivado"
                }
                action={setEpiArchived.bind(
                  null,
                  orgSlug,
                  id,
                  !epi.archived_at,
                )}
              />
            </>
          )
        }
      />

      <Panel className="animate-fade-up">
        <PanelHeader
          title="Certificado de Aprovação"
          actions={
            <CaBadge
              caNumber={epi.ca_number}
              expiresAt={epi.ca_expires_at}
              alertDays={org.alert_days_ca}
            />
          }
        />
        <DetailList
          items={[
            { label: "Número do CA", value: epi.ca_number },
            {
              label: "Validade do CA",
              value: epi.ca_expires_at && formatDate(epi.ca_expires_at),
            },
            { label: "Fabricante", value: epi.manufacturer },
            { label: "Modelo", value: epi.model },
            {
              label: "Vida útil",
              value: epi.lifespan_days && `${epi.lifespan_days} dias`,
            },
            {
              label: "Custo de referência",
              value:
                epi.reference_cost != null &&
                `${formatCurrency(Number(epi.reference_cost))} / ${epi.unit_of_measure}`,
            },
          ]}
        />
      </Panel>

      <VariantsPanel
        orgSlug={orgSlug}
        epiId={id}
        variants={epi.epi_variants}
        canEdit={canEdit && !epi.archived_at}
        unitOfMeasure={epi.unit_of_measure}
      />
    </div>
  );
}
