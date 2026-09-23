import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  ChevronRight,
  FileText,
  HardHat,
  Pencil,
  RotateCcw,
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DetailList, Panel, PanelHeader } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { DialogForm } from "@/components/shared/dialog-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry, canOperateStock } from "@/lib/permissions";
import {
  describeDue,
  formatDate,
  formatDateTime,
  todayInSaoPaulo,
} from "@/lib/format";
import { formatCpf, formatPhone } from "@/lib/validators";
import { getEmployee } from "@/features/employees/queries";
import {
  archiveEmployee,
  reactivateEmployee,
  terminateEmployee,
} from "@/features/employees/actions";
import {
  getEmployeeHoldings,
  listDeliveries,
} from "@/features/deliveries/queries";
import {
  REPLACEMENT_STATUS,
  SIGNATURE_STATUS,
} from "@/features/deliveries/constants";
import { HoldingActions } from "@/features/deliveries/components/HoldingActions";

export const metadata: Metadata = { title: "Funcionário — Almox SST" };

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  const { org, role } = await getOrgContext(orgSlug);
  const employee = await getEmployee(org.id, id);
  if (!employee) notFound();
  const canEdit = canManageRegistry(role);
  const canOperate = canOperateStock(role);
  const inactive = !!employee.terminated_at || !!employee.archived_at;
  const [holdings, deliveries] = await Promise.all([
    getEmployeeHoldings(org.id, id),
    listDeliveries(org.id, { filter: "todas", page: 1, employeeId: id }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title={employee.full_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {employee.job_roles ? (
              <Link
                href={`/${orgSlug}/cargos/${employee.job_roles.id}`}
                className="hover:underline"
              >
                {employee.job_roles.name}
              </Link>
            ) : (
              "Sem cargo definido"
            )}
            {employee.terminated_at && (
              <StatusBadge
                status="pendente"
                label={`Desligado em ${formatDate(employee.terminated_at)}`}
              />
            )}
            {employee.archived_at && (
              <StatusBadge status="pendente" label="Arquivado" />
            )}
          </span>
        }
        backHref={`/${orgSlug}/funcionarios`}
        actions={
          <>
            <Button asChild variant="outline" className="rounded-full">
              <Link
                href={`/${orgSlug}/funcionarios/${id}/ficha`}
                target="_blank"
              >
                <FileText /> Ficha de EPI
              </Link>
            </Button>
            {canOperate && !inactive && (
              <Button asChild className="rounded-full px-5 font-bold">
                <Link href={`/${orgSlug}/entregas/nova?funcionario=${id}`}>
                  <HardHat /> Entregar EPI
                </Link>
              </Button>
            )}
          </>
        }
      />

      {canEdit && (
        <div className="-mt-2 flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link href={`/${orgSlug}/funcionarios/${id}/editar`}>
              <Pencil /> Editar
            </Link>
          </Button>
          {inactive ? (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="rounded-full">
                  <RotateCcw /> Reativar
                </Button>
              }
              title="Reativar funcionário?"
              description="Ele volta a aparecer nas entregas, treinamentos e na conformidade."
              confirmLabel="Reativar"
              successMessage="Funcionário reativado"
              action={reactivateEmployee.bind(null, orgSlug, id)}
            />
          ) : (
            <>
              <DialogForm
                trigger={
                  <Button variant="ghost" size="sm" className="rounded-full">
                    <UserMinus /> Desligar
                  </Button>
                }
                title="Registrar desligamento"
                description={
                  holdings.length
                    ? `Há ${holdings.length} ${holdings.length === 1 ? "item" : "itens"} em posse. Registre as devoluções abaixo. O histórico é mantido.`
                    : "O funcionário sai das entregas e da conformidade. Todo o histórico é mantido."
                }
                fields={[
                  {
                    name: "terminatedAt",
                    label: "Data de desligamento",
                    type: "date",
                    required: true,
                    defaultValue: todayInSaoPaulo(),
                  },
                ]}
                submitLabel="Desligar"
                successMessage="Desligamento registrado"
                action={terminateEmployee.bind(null, orgSlug, id)}
              />
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" className="rounded-full">
                    <Archive /> Arquivar
                  </Button>
                }
                title="Arquivar este cadastro?"
                description="Use para cadastros feitos por engano. O registro some das listas, mas entregas e treinamentos continuam no histórico. Para quem saiu da empresa, prefira Desligar."
                confirmLabel="Arquivar"
                successMessage="Cadastro arquivado"
                action={archiveEmployee.bind(null, orgSlug, id)}
              />
            </>
          )}
        </div>
      )}

      <Panel className="animate-fade-up">
        <PanelHeader
          title="EPIs em posse"
          description={
            holdings.length
              ? "Itens entregues e ainda não devolvidos."
              : undefined
          }
        />
        {holdings.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm sm:px-5">
            Nenhum EPI em posse.
          </p>
        ) : (
          <ul>
            {holdings.map((h) => {
              const rs = REPLACEMENT_STATUS[h.replacement_status ?? "ok"];
              return (
                <li
                  key={h.item_id}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
                >
                  <span className="bg-muted flex h-10 min-w-10 items-center justify-center rounded-full px-2.5 text-sm font-bold">
                    {h.size_label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {h.quantity}× {h.epi_name}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      Entregue em {formatDate(h.delivered_at!)}
                      {h.next_replacement_at &&
                        ` · troca ${describeDue(h.next_replacement_at)}`}
                      {h.signature_status === "pendente" && " · sem assinatura"}
                    </p>
                  </div>
                  <StatusBadge
                    status={rs.status}
                    label={rs.label}
                    className="hidden sm:inline-flex"
                  />
                  {canOperate && (
                    <HoldingActions
                      orgSlug={orgSlug}
                      itemId={h.item_id!}
                      employeeId={id}
                      label={`${h.epi_name} ${h.size_label}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel className="animate-fade-up">
        <PanelHeader title="Entregas" />
        {deliveries.rows.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm sm:px-5">
            Nenhuma entrega registrada.
          </p>
        ) : (
          <ul>
            {deliveries.rows.map((d) => {
              const status = SIGNATURE_STATUS[d.signature_status];
              return (
                <li key={d.id} className="border-b last:border-b-0">
                  <Link
                    href={`/${orgSlug}/entregas/${d.id}`}
                    className="hover:bg-foreground/[0.03] flex items-center gap-3 px-4 py-3 transition-colors sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {formatDateTime(d.delivered_at)}
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {d.epi_delivery_items
                          .map(
                            (i) =>
                              `${i.quantity}× ${i.epi_name_snapshot} ${i.size_label_snapshot}`,
                          )
                          .join(", ")}
                      </p>
                    </div>
                    <StatusBadge
                      status={status.status}
                      label={status.label}
                      className="hidden sm:inline-flex"
                    />
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel className="animate-fade-up">
        <PanelHeader
          title="Dados"
          actions={
            <AvatarInitials
              name={employee.full_name}
              muted={inactive}
              className="size-12 text-base"
            />
          }
        />
        <DetailList
          items={[
            { label: "CPF", value: formatCpf(employee.cpf) },
            { label: "Matrícula", value: employee.registration },
            { label: "Setor", value: employee.sectors?.name },
            { label: "Unidade", value: employee.units?.name },
            {
              label: "Admissão",
              value: employee.hired_at && formatDate(employee.hired_at),
            },
            {
              label: "Celular",
              value: employee.phone && formatPhone(employee.phone),
            },
            { label: "E-mail", value: employee.email },
          ]}
        />
      </Panel>
    </div>
  );
}
