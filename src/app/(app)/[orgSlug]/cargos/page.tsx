import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { EmptyState } from "@/components/shared/empty-state";
import { DialogForm } from "@/components/shared/dialog-form";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { listJobRoles } from "@/features/structure/queries";
import { createJobRole } from "@/features/structure/actions";

export const metadata: Metadata = { title: "Cargos — Almox SST" };

const JOB_ROLE_FIELDS = [
  {
    name: "name",
    label: "Nome do cargo",
    required: true,
    placeholder: "Ex.: Soldador",
  },
  { name: "cbo", label: "CBO", placeholder: "0000-00" },
  { name: "description", label: "Descrição", type: "textarea" as const },
];

export default async function JobRolesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org, role } = await getOrgContext(orgSlug);
  const jobRoles = await listJobRoles(org.id);
  const canEdit = canManageRegistry(role);

  const newButton = canEdit && (
    <DialogForm
      trigger={
        <Button className="rounded-full px-5 font-bold">
          <Plus /> Novo cargo
        </Button>
      }
      title="Novo cargo"
      description="Depois de criar, defina os EPIs e treinamentos obrigatórios."
      fields={JOB_ROLE_FIELDS}
      submitLabel="Criar cargo"
      successMessage="Cargo criado"
      action={createJobRole.bind(null, orgSlug)}
    />
  );

  return (
    <>
      <PageHeader
        title="Cargos"
        description="Cada cargo define os EPIs e treinamentos obrigatórios da função."
        actions={newButton}
      />
      <Panel className="animate-fade-up">
        {jobRoles.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            className="rounded-none border-0"
            title="Nenhum cargo cadastrado"
            description="Cadastre os cargos da empresa para montar a matriz de EPIs e treinamentos."
            action={newButton || undefined}
          />
        ) : (
          <ul>
            {jobRoles.map((jr) => (
              <li key={jr.id} className="border-b last:border-b-0">
                <Link
                  href={`/${orgSlug}/cargos/${jr.id}`}
                  className="hover:bg-foreground/[0.03] flex items-center gap-3 px-4 py-3 transition-colors sm:px-5"
                >
                  <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                    <BriefcaseBusiness className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {jr.name}
                      {jr.cbo && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · CBO {jr.cbo}
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {jr.employeeCount}{" "}
                      {jr.employeeCount === 1 ? "funcionário" : "funcionários"}{" "}
                      · {jr.epiCount}{" "}
                      {jr.epiCount === 1
                        ? "EPI obrigatório"
                        : "EPIs obrigatórios"}{" "}
                      · {jr.trainingCount}{" "}
                      {jr.trainingCount === 1 ? "treinamento" : "treinamentos"}
                    </p>
                  </div>
                  <ChevronRight
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
