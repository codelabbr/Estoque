import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, Pencil, RotateCcw, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DetailList, Panel, PanelHeader } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { DialogForm } from "@/components/shared/dialog-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { formatDate, todayInSaoPaulo } from "@/lib/format";
import { formatCpf, formatPhone } from "@/lib/validators";
import { getEmployee } from "@/features/employees/queries";
import {
  archiveEmployee,
  reactivateEmployee,
  terminateEmployee,
} from "@/features/employees/actions";

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
  const inactive = !!employee.terminated_at || !!employee.archived_at;

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
          canEdit && (
            <>
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/${orgSlug}/funcionarios/${id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Button>
              {inactive ? (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" className="rounded-full">
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
                      <Button variant="ghost" className="rounded-full">
                        <UserMinus /> Desligar
                      </Button>
                    }
                    title="Registrar desligamento"
                    description="O funcionário sai das entregas e da conformidade. Todo o histórico é mantido. Registre a devolução dos EPIs em posse."
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        aria-label="Arquivar cadastro"
                      >
                        <Archive />
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
            </>
          )
        }
      />

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
