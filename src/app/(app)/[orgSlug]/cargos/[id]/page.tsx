import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Archive,
  GraduationCap,
  Pencil,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { DialogForm } from "@/components/shared/dialog-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import {
  getJobRole,
  listTrainingTypeOptions,
} from "@/features/structure/queries";
import { listEpiOptions } from "@/features/epis/queries";
import {
  addEpiRequirement,
  addTrainingRequirement,
  archiveJobRole,
  removeEpiRequirement,
  removeTrainingRequirement,
  updateEpiRequirement,
  updateJobRole,
} from "@/features/structure/actions";
import { StatusBadge } from "@/components/shared/status-badge";
import type { DialogField } from "@/components/shared/dialog-form";

const MANDATORY_OPTIONS = [
  { value: "sim", label: "Obrigatório (conta na conformidade)" },
  { value: "nao", label: "Recomendado (só aparece como sugestão)" },
];

function requirementFields(defaults: {
  quantity: number;
  replacementDays: number | null;
  mandatory: boolean;
  lifespanDays: number | null;
}): DialogField[] {
  return [
    {
      name: "quantity",
      label: "Quantidade por entrega",
      type: "number",
      required: true,
      defaultValue: String(defaults.quantity),
      inputMode: "numeric",
    },
    {
      name: "replacementDays",
      label: "Troca a cada (dias)",
      type: "number",
      inputMode: "numeric",
      defaultValue: defaults.replacementDays
        ? String(defaults.replacementDays)
        : "",
      placeholder: defaults.lifespanDays
        ? `Vida útil do EPI: ${defaults.lifespanDays}`
        : "Vazio = vida útil do EPI",
      description:
        "Deixe vazio para usar a vida útil do EPI. Preencha para uma troca mais frequente neste cargo.",
    },
    {
      name: "mandatory",
      label: "Exigência",
      type: "select",
      required: true,
      defaultValue: defaults.mandatory ? "sim" : "nao",
      options: MANDATORY_OPTIONS,
    },
  ];
}

function periodLabel(
  replacementDays: number | null,
  lifespanDays: number | null,
) {
  if (replacementDays)
    return `troca a cada ${replacementDays} dias neste cargo`;
  if (lifespanDays) return `troca a cada ${lifespanDays} dias (vida útil)`;
  return "sem periodicidade de troca";
}

export const metadata: Metadata = { title: "Cargo — Almox SST" };

export default async function JobRoleDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  const { org, role } = await getOrgContext(orgSlug);
  const jobRole = await getJobRole(org.id, id);
  if (!jobRole || jobRole.archived_at) notFound();
  const canEdit = canManageRegistry(role);

  const [epis, trainingTypes] = canEdit
    ? await Promise.all([
        listEpiOptions(org.id),
        listTrainingTypeOptions(org.id),
      ])
    : [[], []];

  const epiReqs = jobRole.job_role_epi_requirements
    .filter((r) => r.epis)
    .sort((a, b) => a.epis!.name.localeCompare(b.epis!.name, "pt-BR"));
  const trainingReqs = jobRole.job_role_training_requirements
    .filter((r) => r.training_types)
    .sort((a, b) =>
      a.training_types!.name.localeCompare(b.training_types!.name, "pt-BR"),
    );
  const availableEpis = epis.filter(
    (e) => !epiReqs.some((r) => r.epis!.id === e.id),
  );
  const availableTrainings = trainingTypes.filter(
    (t) => !trainingReqs.some((r) => r.training_types!.id === t.id),
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title={jobRole.name}
        description={
          [jobRole.cbo && `CBO ${jobRole.cbo}`, jobRole.description]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        backHref={`/${orgSlug}/cargos`}
        actions={
          canEdit && (
            <>
              <DialogForm
                trigger={
                  <Button variant="outline" className="rounded-full">
                    <Pencil /> Editar
                  </Button>
                }
                title="Editar cargo"
                fields={[
                  {
                    name: "name",
                    label: "Nome do cargo",
                    required: true,
                    defaultValue: jobRole.name,
                  },
                  {
                    name: "cbo",
                    label: "CBO",
                    placeholder: "0000-00",
                    defaultValue: jobRole.cbo ?? "",
                  },
                  {
                    name: "description",
                    label: "Descrição",
                    type: "textarea",
                    defaultValue: jobRole.description ?? "",
                  },
                ]}
                submitLabel="Salvar"
                successMessage="Cargo atualizado"
                action={updateJobRole.bind(null, orgSlug, id)}
              />
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" className="rounded-full">
                    <Archive /> Arquivar
                  </Button>
                }
                title="Arquivar este cargo?"
                description="Ele deixa de aparecer no cadastro de funcionários. Funcionários que já têm este cargo continuam com ele."
                confirmLabel="Arquivar"
                successMessage="Cargo arquivado"
                action={archiveJobRole.bind(null, orgSlug, id)}
              />
            </>
          )
        }
      />

      <Panel className="animate-fade-up">
        <PanelHeader
          title="EPIs obrigatórios"
          description="Sugeridos automaticamente na entrega. Os obrigatórios contam na conformidade."
          actions={
            canEdit &&
            availableEpis.length > 0 && (
              <DialogForm
                trigger={
                  <Button size="sm" variant="outline" className="rounded-full">
                    <Plus /> EPI
                  </Button>
                }
                title="Adicionar EPI obrigatório"
                fields={[
                  {
                    name: "epiId",
                    label: "EPI",
                    type: "select",
                    required: true,
                    options: availableEpis.map((e) => ({
                      value: e.id,
                      label: e.caNumber
                        ? `${e.name} (CA ${e.caNumber})`
                        : e.name,
                    })),
                  },
                  ...requirementFields({
                    quantity: 1,
                    replacementDays: null,
                    mandatory: true,
                    lifespanDays: null,
                  }),
                ]}
                submitLabel="Adicionar"
                successMessage="EPI adicionado ao cargo"
                action={addEpiRequirement.bind(null, orgSlug, id)}
              />
            )
          }
        />
        {epiReqs.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm sm:px-5">
            {canEdit && epis.length === 0
              ? "Cadastre EPIs no catálogo para vinculá-los a este cargo."
              : "Nenhum EPI obrigatório definido."}
          </p>
        ) : (
          <ul>
            {epiReqs.map((r) => (
              <li
                key={r.epis!.id}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
              >
                <ShieldCheck
                  className="text-primary size-5 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.epis!.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {r.quantity} {r.quantity === 1 ? "unidade" : "unidades"}
                    {" · "}
                    {periodLabel(r.replacement_days, r.epis!.lifespan_days)}
                    {r.epis!.ca_number && ` · CA ${r.epis!.ca_number}`}
                  </p>
                </div>
                <StatusBadge
                  status={r.mandatory ? "ok" : "pendente"}
                  label={r.mandatory ? "Obrigatório" : "Recomendado"}
                />
                {canEdit && (
                  <DialogForm
                    trigger={
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={`Editar ${r.epis!.name}`}
                      >
                        <Pencil />
                      </Button>
                    }
                    title={`Editar ${r.epis!.name} neste cargo`}
                    fields={requirementFields({
                      quantity: r.quantity,
                      replacementDays: r.replacement_days,
                      mandatory: r.mandatory,
                      lifespanDays: r.epis!.lifespan_days,
                    })}
                    submitLabel="Salvar"
                    successMessage="Matriz atualizada"
                    action={updateEpiRequirement.bind(
                      null,
                      orgSlug,
                      id,
                      r.epis!.id,
                    )}
                  />
                )}
                {canEdit && (
                  <ConfirmDialog
                    trigger={
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={`Remover ${r.epis!.name}`}
                      >
                        <X />
                      </Button>
                    }
                    title={`Remover ${r.epis!.name} do cargo?`}
                    description="Ele deixa de ser sugerido na entrega e de contar na conformidade deste cargo."
                    confirmLabel="Remover"
                    successMessage="EPI removido do cargo"
                    action={removeEpiRequirement.bind(
                      null,
                      orgSlug,
                      id,
                      r.epis!.id,
                    )}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="animate-fade-up">
        <PanelHeader
          title="Treinamentos obrigatórios"
          description="Quem ocupa este cargo sem o treinamento aparece como irregular."
          actions={
            canEdit &&
            availableTrainings.length > 0 && (
              <DialogForm
                trigger={
                  <Button size="sm" variant="outline" className="rounded-full">
                    <Plus /> Treinamento
                  </Button>
                }
                title="Adicionar treinamento obrigatório"
                fields={[
                  {
                    name: "trainingTypeId",
                    label: "Treinamento",
                    type: "select",
                    required: true,
                    options: availableTrainings.map((t) => ({
                      value: t.id,
                      label: t.name,
                    })),
                  },
                ]}
                submitLabel="Adicionar"
                successMessage="Treinamento adicionado ao cargo"
                action={addTrainingRequirement.bind(null, orgSlug, id)}
              />
            )
          }
        />
        {trainingReqs.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm sm:px-5">
            Nenhum treinamento obrigatório definido.
          </p>
        ) : (
          <ul>
            {trainingReqs.map((r) => (
              <li
                key={r.training_types!.id}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
              >
                <GraduationCap
                  className="text-primary size-5 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.training_types!.name}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {r.training_types!.validity_months
                      ? `Validade de ${r.training_types!.validity_months} meses`
                      : "Sem vencimento fixo"}
                  </p>
                </div>
                {canEdit && (
                  <ConfirmDialog
                    trigger={
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={`Remover ${r.training_types!.name}`}
                      >
                        <X />
                      </Button>
                    }
                    title={`Remover ${r.training_types!.name} do cargo?`}
                    description="Ele deixa de contar na conformidade de quem ocupa este cargo."
                    confirmLabel="Remover"
                    successMessage="Treinamento removido do cargo"
                    action={removeTrainingRequirement.bind(
                      null,
                      orgSlug,
                      id,
                      r.training_types!.id,
                    )}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground border-t px-4 py-3 text-xs sm:px-5">
          Os prazos de reciclagem sugeridos são editáveis. Confirme-os com o
          responsável técnico de segurança.
        </p>
      </Panel>
    </div>
  );
}
