import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Plus,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DetailList, Panel, PanelHeader } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { DialogForm } from "@/components/shared/dialog-form";
import { getOrgContext } from "@/lib/org";
import { canOperateStock } from "@/lib/permissions";
import { formatDate, formatDateTime, todayInSaoPaulo } from "@/lib/format";
import { maskCpfPartial } from "@/lib/validators";
import { getDelivery } from "@/features/deliveries/queries";
import {
  REASON_LABELS,
  SIGNATURE_STATUS,
} from "@/features/deliveries/constants";
import { cancelDelivery } from "@/features/deliveries/actions";
import { SignaturePanel } from "@/features/deliveries/components/SignaturePanel";

export const metadata: Metadata = { title: "Entrega — Almox SST" };

export default async function DeliveryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
  searchParams: Promise<{ nova?: string }>;
}) {
  const { orgSlug, id } = await params;
  const { nova } = await searchParams;
  const { org, role } = await getOrgContext(orgSlug);
  const delivery = await getDelivery(org.id, id);
  if (!delivery) notFound();
  const canOperate = canOperateStock(role);
  const status = SIGNATURE_STATUS[delivery.signature_status];
  const pending = delivery.signature_status === "pendente";
  const deliveredToday =
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(delivery.delivered_at),
    ) === todayInSaoPaulo();
  const items = delivery.epi_delivery_items;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title={nova ? "Entrega registrada" : "Entrega"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {formatDateTime(delivery.delivered_at)}
            <StatusBadge status={status.status} label={status.label} />
          </span>
        }
        backHref={`/${orgSlug}/entregas`}
        actions={
          <>
            <Button asChild variant="outline" className="rounded-full">
              <Link
                href={`/${orgSlug}/funcionarios/${delivery.employee_id}/ficha`}
                target="_blank"
              >
                <FileText /> Ficha de EPI
              </Link>
            </Button>
            {canOperate && pending && deliveredToday && (
              <DialogForm
                trigger={
                  <Button variant="ghost" className="rounded-full">
                    <XCircle /> Cancelar
                  </Button>
                }
                title="Cancelar entrega"
                description="Os itens voltam para o estoque e a entrega fica marcada como cancelada no histórico."
                fields={[
                  {
                    name: "reason",
                    label: "Motivo",
                    type: "textarea",
                    required: true,
                    placeholder: "Ex.: tamanho errado",
                  },
                ]}
                submitLabel="Cancelar entrega"
                successMessage="Entrega cancelada"
                action={cancelDelivery.bind(null, orgSlug, id)}
              />
            )}
          </>
        }
      />

      {canOperate && pending && (
        <SignaturePanel
          orgSlug={orgSlug}
          deliveryId={id}
          employeeName={delivery.employee_name_snapshot}
          term={delivery.term_text}
          items={items.map((i) => ({
            epi: i.epi_name_snapshot,
            size: i.size_label_snapshot,
            quantity: i.quantity,
            ca: i.ca_number_snapshot,
          }))}
          openRequest={delivery.openRequest}
        />
      )}

      <Panel className="animate-fade-up">
        <PanelHeader
          title={delivery.employee_name_snapshot}
          description={`CPF ${maskCpfPartial(delivery.employee_cpf_snapshot)}`}
          actions={
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href={`/${orgSlug}/funcionarios/${delivery.employee_id}`}>
                Ver funcionário
              </Link>
            </Button>
          }
        />
        <ul>
          {items.map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
            >
              <span className="bg-muted flex h-10 min-w-10 items-center justify-center rounded-full px-2.5 text-sm font-bold tabular-nums">
                {i.quantity}×
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {i.epi_name_snapshot}{" "}
                  <span className="text-muted-foreground font-normal">
                    · {i.size_label_snapshot}
                  </span>
                </p>
                <p className="text-muted-foreground truncate text-sm">
                  {[
                    REASON_LABELS[i.reason],
                    i.ca_number_snapshot && `CA ${i.ca_number_snapshot}`,
                    i.next_replacement_at &&
                      `troca em ${formatDate(i.next_replacement_at)}`,
                    i.returned_at &&
                      `devolvido em ${formatDate(i.returned_at)} (${i.return_destination === "estoque" ? "estoque" : "descarte"})`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {i.ca_expired_override && (
                <span title="Entregue com CA vencido (confirmado pelo usuário)">
                  <AlertTriangle
                    className="text-status-irregular-foreground size-5"
                    aria-label="CA vencido"
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
        {delivery.notes && (
          <p className="text-muted-foreground border-t px-4 py-3 text-sm sm:px-5">
            {delivery.notes}
          </p>
        )}
      </Panel>

      {delivery.signature && (
        <Panel className="animate-fade-up">
          <PanelHeader
            title="Assinatura"
            actions={
              <CheckCircle2
                className="text-status-ok-foreground size-6"
                aria-hidden="true"
              />
            }
          />
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            {delivery.signature.imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={delivery.signature.imageDataUrl}
                alt={`Assinatura de ${delivery.employee_name_snapshot}`}
                className="h-32 w-full rounded-2xl border bg-white object-contain"
              />
            ) : (
              <p className="rounded-2xl border bg-white px-4 py-6 text-center font-serif text-2xl text-neutral-900 italic">
                {delivery.signature.typed_name}
              </p>
            )}
            <DetailList
              items={[
                {
                  label: "Assinada em",
                  value: formatDateTime(delivery.signature.signed_at),
                },
                {
                  label: "Forma",
                  value:
                    delivery.signature.method === "desenho"
                      ? "Desenhada"
                      : "Nome digitado",
                },
                { label: "Endereço IP", value: delivery.signature.ip },
                {
                  label: "Código de integridade",
                  value: (
                    <code className="text-xs">
                      {delivery.content_hash.slice(0, 16)}
                    </code>
                  ),
                },
              ]}
            />
          </div>
        </Panel>
      )}

      {delivery.signature_status === "cancelada" && (
        <Panel className="p-4 sm:p-5">
          <p className="font-bold">
            Entrega cancelada em{" "}
            {delivery.cancelled_at && formatDateTime(delivery.cancelled_at)}
          </p>
          <p className="text-muted-foreground text-sm">
            {delivery.cancel_reason}
          </p>
        </Panel>
      )}

      {nova && canOperate && (
        <div className="flex justify-center">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-full px-8 text-base font-bold"
          >
            <Link href={`/${orgSlug}/entregas/nova`}>
              <Plus /> Nova entrega
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
