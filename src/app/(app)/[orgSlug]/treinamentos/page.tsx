import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  GraduationCap,
  Pencil,
  Plus,
  Archive,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { DialogForm } from "@/components/shared/dialog-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pagination, pageFromParams } from "@/components/shared/pagination";
import { NativeSelectLinks } from "@/features/trainings/components/NativeSelectLinks";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry, isOrgAdmin } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { listJobRoles } from "@/features/structure/queries";
import {
  getTrainingMatrix,
  listTrainingRecords,
  listTrainingTypes,
  type MatrixCell,
} from "@/features/trainings/queries";
import {
  archiveTrainingType,
  createTrainingType,
  deleteTrainingRecord,
  updateTrainingType,
} from "@/features/trainings/actions";
import { TRAINING_STATUS } from "@/features/trainings/constants";
import { CertificateLink } from "@/features/trainings/components/CertificateLink";

export const metadata: Metadata = { title: "Treinamentos — Almox SST" };

const TABS = [
  { value: "matriz", label: "Matriz" },
  { value: "registros", label: "Registros" },
  { value: "tipos", label: "Tipos" },
];

const CELL_ICON = {
  valido: CheckCircle2,
  a_vencer: Clock,
  vencido: AlertTriangle,
  pendente: CircleDashed,
};
const CELL_CLASS = {
  valido: "bg-status-ok text-status-ok-foreground",
  a_vencer: "bg-status-atencao text-status-atencao-foreground",
  vencido: "bg-status-irregular text-status-irregular-foreground",
  pendente: "bg-status-pendente text-status-pendente-foreground",
};

/** dd/MM/aa para caber na célula da matriz. */
function shortDate(date: string) {
  const d = formatDate(date);
  return `${d.slice(0, 6)}${d.slice(8)}`;
}

function Cell({ cell }: { cell?: MatrixCell }) {
  if (!cell || (cell.status === "pendente" && !cell.required)) {
    return <span className="text-muted-foreground/50">·</span>;
  }
  const Icon = CELL_ICON[cell.status];
  const label = TRAINING_STATUS[cell.status].label;
  const detail = cell.expiresAt
    ? `vence ${formatDate(cell.expiresAt)}`
    : cell.completedAt
      ? `feito ${formatDate(cell.completedAt)}`
      : "";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${CELL_CLASS[cell.status]}`}
      title={[label, detail].filter(Boolean).join(" · ")}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      {cell.expiresAt ? shortDate(cell.expiresAt) : label}
    </span>
  );
}

const TYPE_FIELDS = (t?: {
  name: string;
  regulation: string | null;
  validity_months: number | null;
  workload_hours: number | null;
}) => [
  {
    name: "name",
    label: "Nome",
    required: true,
    placeholder: "Ex.: NR-35 Trabalho em altura",
    defaultValue: t?.name,
  },
  {
    name: "regulation",
    label: "Norma",
    placeholder: "NR-35",
    defaultValue: t?.regulation ?? "",
  },
  {
    name: "validityMonths",
    label: "Validade (meses)",
    type: "number" as const,
    inputMode: "numeric" as const,
    defaultValue: t?.validity_months ? String(t.validity_months) : "",
    description:
      "Deixe em branco se não houver vencimento fixo. Confirme o prazo com o responsável técnico.",
  },
  {
    name: "workloadHours",
    label: "Carga horária padrão (h)",
    inputMode: "decimal" as const,
    defaultValue: t?.workload_hours ? String(t.workload_hours) : "",
  },
];

export default async function TrainingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const tab = TABS.some((t) => t.value === sp.aba) ? sp.aba! : "matriz";
  const { org, role } = await getOrgContext(orgSlug);
  const canEdit = canManageRegistry(role);

  return (
    <>
      <PageHeader
        title="Treinamentos"
        description="Validade das NRs e conformidade por funcionário."
        actions={
          canEdit && (
            <Button asChild className="rounded-full px-5 font-bold">
              <Link href={`/${orgSlug}/treinamentos/registrar`}>
                <Plus /> Registrar treinamento
              </Link>
            </Button>
          )
        }
      />
      <Panel className="animate-fade-up">
        <FilterTabs
          items={TABS}
          current={tab}
          hrefFor={(v) =>
            `/${orgSlug}/treinamentos${v === "matriz" ? "" : `?aba=${v}`}`
          }
        />
      </Panel>
      {tab === "matriz" && (
        <MatrixTab
          orgSlug={orgSlug}
          orgId={org.id}
          jobRoleId={sp.cargo}
          onlyIssues={sp.pendencias === "1"}
        />
      )}
      {tab === "registros" && (
        <RecordsTab
          orgSlug={orgSlug}
          orgId={org.id}
          page={pageFromParams(sp.page)}
          canDelete={isOrgAdmin(role)}
        />
      )}
      {tab === "tipos" && (
        <TypesTab orgSlug={orgSlug} orgId={org.id} canEdit={canEdit} />
      )}
    </>
  );
}

async function MatrixTab({
  orgSlug,
  orgId,
  jobRoleId,
  onlyIssues,
}: {
  orgSlug: string;
  orgId: string;
  jobRoleId?: string;
  onlyIssues: boolean;
}) {
  const [{ columns, rows }, jobRoles] = await Promise.all([
    getTrainingMatrix(orgId, { jobRoleId, onlyIssues }),
    listJobRoles(orgId),
  ]);
  const base = `/${orgSlug}/treinamentos`;
  const link = (o: { cargo?: string; pendencias?: boolean }) => {
    const p = new URLSearchParams();
    const cargo = "cargo" in o ? o.cargo : jobRoleId;
    const pend = "pendencias" in o ? o.pendencias : onlyIssues;
    if (cargo) p.set("cargo", cargo);
    if (pend) p.set("pendencias", "1");
    return `${base}${p.size ? `?${p}` : ""}`;
  };

  return (
    <Panel className="animate-fade-up">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5">
        <NativeSelectLinks
          label="Filtrar por cargo"
          value={jobRoleId ?? ""}
          options={[
            {
              value: "",
              label: "Todos os cargos",
              href: link({ cargo: undefined }),
            },
            ...jobRoles.map((j) => ({
              value: j.id,
              label: j.name,
              href: link({ cargo: j.id }),
            })),
          ]}
        />
        <Button
          asChild
          size="sm"
          variant={onlyIssues ? "secondary" : "ghost"}
          className="rounded-full"
        >
          <Link href={link({ pendencias: !onlyIssues })}>Só pendências</Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="ml-auto rounded-full"
        >
          <Link
            href={`/${orgSlug}/relatorios/matriz-treinamentos.csv${jobRoleId ? `?cargo=${jobRoleId}` : ""}`}
            prefetch={false}
          >
            Exportar CSV
          </Link>
        </Button>
      </div>
      {rows.length === 0 || columns.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          className="rounded-none border-0"
          title={
            onlyIssues
              ? "Nenhuma pendência"
              : "A matriz aparece quando houver exigências"
          }
          description={
            onlyIssues
              ? "Todos os treinamentos exigidos estão em dia."
              : "Defina os treinamentos obrigatórios de cada cargo ou registre treinamentos realizados."
          }
          action={
            !onlyIssues ? (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/${orgSlug}/cargos`}>Ir para Cargos</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="bg-background sticky left-0 z-10 border-b px-4 py-3 text-left font-bold sm:px-5"
                >
                  Funcionário
                </th>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    className="min-w-28 border-b px-2 py-3 text-left align-bottom text-xs font-bold"
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-foreground/[0.02]">
                  <th
                    scope="row"
                    className="bg-background sticky left-0 z-10 border-b px-4 py-2 text-left font-medium sm:px-5"
                  >
                    <Link
                      href={`/${orgSlug}/funcionarios/${r.id}`}
                      className="hover:underline"
                    >
                      {r.name}
                    </Link>
                  </th>
                  {columns.map((c) => (
                    <td key={c.id} className="border-b px-2 py-2">
                      <Cell cell={r.cells[c.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

async function RecordsTab({
  orgSlug,
  orgId,
  page,
  canDelete,
}: {
  orgSlug: string;
  orgId: string;
  page: number;
  canDelete: boolean;
}) {
  const { rows, total } = await listTrainingRecords(orgId, page);
  return (
    <Panel className="animate-fade-up">
      {rows.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          className="rounded-none border-0"
          title="Nenhum treinamento registrado"
          description="Registre turmas ou treinamentos individuais."
        />
      ) : (
        <ul>
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
            >
              <GraduationCap
                className="text-primary size-5 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <Link
                    href={`/${orgSlug}/funcionarios/${r.employees?.id}`}
                    className="font-bold hover:underline"
                  >
                    {r.employees?.full_name}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    · {r.training_types?.name}
                  </span>
                </p>
                <p className="text-muted-foreground truncate text-sm">
                  {[
                    `Concluído em ${formatDate(r.completed_at)}`,
                    r.expires_at
                      ? `vence ${formatDate(r.expires_at)}`
                      : "sem vencimento",
                    r.provider,
                    !r.certificate_path && "sem certificado",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {r.certificate_path && (
                <CertificateLink orgSlug={orgSlug} path={r.certificate_path} />
              )}
              {canDelete && (
                <ConfirmDialog
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      aria-label="Excluir registro"
                    >
                      <Trash2 />
                    </Button>
                  }
                  title="Excluir este registro?"
                  description="Use só para lançamentos errados. A exclusão fica registrada na auditoria."
                  confirmLabel="Excluir"
                  destructive
                  successMessage="Registro excluído"
                  action={deleteTrainingRecord.bind(null, orgSlug, r.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        total={total}
        hrefFor={(p) =>
          `/${orgSlug}/treinamentos?aba=registros${p > 1 ? `&page=${p}` : ""}`
        }
      />
    </Panel>
  );
}

async function TypesTab({
  orgSlug,
  orgId,
  canEdit,
}: {
  orgSlug: string;
  orgId: string;
  canEdit: boolean;
}) {
  const types = await listTrainingTypes(orgId);
  return (
    <Panel className="animate-fade-up">
      <PanelHeader
        title="Tipos de treinamento"
        description="Sugestões iniciais editáveis. Confirme os prazos de reciclagem com o responsável técnico."
        actions={
          canEdit && (
            <DialogForm
              trigger={
                <Button size="sm" variant="outline" className="rounded-full">
                  <Plus /> Tipo
                </Button>
              }
              title="Novo tipo de treinamento"
              fields={TYPE_FIELDS()}
              submitLabel="Criar"
              successMessage="Tipo criado"
              action={createTrainingType.bind(null, orgSlug)}
            />
          )
        }
      />
      <ul>
        {types.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
          >
            <GraduationCap
              className="text-primary size-5 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{t.name}</p>
              <p className="text-muted-foreground text-sm">
                {t.validity_months
                  ? `Validade de ${t.validity_months} meses`
                  : "Sem vencimento fixo"}
                {t.workload_hours ? ` · ${t.workload_hours} h` : ""}
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <DialogForm
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      aria-label={`Editar ${t.name}`}
                    >
                      <Pencil />
                    </Button>
                  }
                  title="Editar tipo de treinamento"
                  description="Mudar a validade não altera vencimentos já registrados."
                  fields={TYPE_FIELDS(t)}
                  submitLabel="Salvar"
                  successMessage="Tipo atualizado"
                  action={updateTrainingType.bind(null, orgSlug, t.id)}
                />
                <ConfirmDialog
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      aria-label={`Arquivar ${t.name}`}
                    >
                      <Archive />
                    </Button>
                  }
                  title={`Arquivar ${t.name}?`}
                  description="Ele deixa de aparecer para novos registros. O histórico é mantido."
                  confirmLabel="Arquivar"
                  successMessage="Tipo arquivado"
                  action={archiveTrainingType.bind(null, orgSlug, t.id)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
