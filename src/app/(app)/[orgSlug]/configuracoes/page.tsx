import type { Metadata } from "next";
import {
  Archive,
  Building2,
  Layers,
  Pencil,
  Plus,
  UserX,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { DialogForm } from "@/components/shared/dialog-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { getOrgContext } from "@/lib/org";
import {
  canManageRegistry,
  isOrgAdmin,
  ROLE_LABELS,
  type OrgRole,
} from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { listSectors, listUnits } from "@/features/structure/queries";
import { listOrgMembers } from "@/features/organizations/queries";
import {
  archiveSector,
  archiveUnit,
  createSector,
  createUnit,
} from "@/features/structure/actions";
import {
  changeMemberRole,
  removeMember,
} from "@/features/organizations/actions";
import { OrganizationSettingsForm } from "@/features/organizations/components/OrganizationSettingsForm";
import { InviteDialog } from "@/features/organizations/components/InviteDialog";
import { listPendingInvites } from "@/features/organizations/queries";
import { revokeInvite } from "@/features/organizations/actions";
import { listLocations } from "@/features/stock/queries";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ALERT_SETTINGS } from "@/features/alerts/digest";
import { AlertSettingsPanel } from "@/features/alerts/components/AlertSettingsPanel";
import { listAuditLog } from "@/features/audit/queries";
import { AUDIT_FILTERS } from "@/features/audit/utils";
import { AuditTrail } from "@/features/audit/components/AuditTrail";
import { archiveLocation, createLocation } from "@/features/stock/actions";

export const metadata: Metadata = { title: "Configurações — Almox SST" };

const TABS = [
  { value: "organizacao", label: "Organização" },
  { value: "estrutura", label: "Estrutura" },
  { value: "equipe", label: "Equipe" },
  { value: "alertas", label: "Alertas" },
];

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Acesso total, inclusive cobrança e exclusão de dados.",
  admin: "Configurações, equipe e todos os módulos.",
  safety: "Cadastros, treinamentos, entregas e estoque.",
  storekeeper: "Entregas e estoque.",
  viewer: "Apenas consulta.",
};

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ aba?: string; filtro?: string; pagina?: string }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const { org, role, user } = await getOrgContext(orgSlug);
  // Auditoria só para quem pode lê-la (a RLS também restringe a owner/admin).
  const tabs = isOrgAdmin(role)
    ? [...TABS, { value: "auditoria", label: "Auditoria" }]
    : TABS;
  const tab = tabs.some((t) => t.value === sp.aba) ? sp.aba! : "organizacao";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title="Configurações" description={org.name} />
      <Panel className="animate-fade-up">
        <FilterTabs
          items={tabs}
          current={tab}
          hrefFor={(v) =>
            `/${orgSlug}/configuracoes${v === "organizacao" ? "" : `?aba=${v}`}`
          }
        />
      </Panel>

      {tab === "organizacao" && (
        <OrganizationSettingsForm
          orgSlug={orgSlug}
          readOnly={!isOrgAdmin(role)}
          defaultValues={{
            name: org.name,
            legalName: org.legal_name ?? "",
            cnpj: org.cnpj ?? "",
            responsibilityTerm: org.responsibility_term,
            alertDaysCa: String(org.alert_days_ca),
            alertDaysEpi: String(org.alert_days_epi),
            alertDaysTraining: String(org.alert_days_training),
          }}
        />
      )}

      {tab === "estrutura" && (
        <>
          <StructureTab
            orgSlug={orgSlug}
            orgId={org.id}
            canEdit={canManageRegistry(role)}
          />
          <LocationsPanel
            orgSlug={orgSlug}
            orgId={org.id}
            canEdit={isOrgAdmin(role)}
          />
        </>
      )}
      {tab === "equipe" && (
        <TeamTab
          orgSlug={orgSlug}
          orgId={org.id}
          canEdit={isOrgAdmin(role)}
          currentUserId={user.id}
        />
      )}
      {tab === "alertas" && (
        <AlertsTab
          orgSlug={orgSlug}
          orgId={org.id}
          canEdit={isOrgAdmin(role)}
        />
      )}
      {tab === "auditoria" && (
        <AuditTab
          orgSlug={orgSlug}
          orgId={org.id}
          filter={
            AUDIT_FILTERS.some((f) => f.value === sp.filtro)
              ? sp.filtro!
              : "todos"
          }
          page={Math.max(1, Number(sp.pagina) || 1)}
        />
      )}
    </div>
  );
}

async function AuditTab({
  orgSlug,
  orgId,
  filter,
  page,
}: {
  orgSlug: string;
  orgId: string;
  filter: string;
  page: number;
}) {
  const [{ rows, hasMore }, members] = await Promise.all([
    listAuditLog(orgId, filter, page),
    listOrgMembers(orgId),
  ]);
  return (
    <AuditTrail
      orgSlug={orgSlug}
      rows={rows}
      filter={filter}
      page={page}
      hasMore={hasMore}
      actorEmails={Object.fromEntries(members.map((m) => [m.user_id, m.email]))}
    />
  );
}

async function AlertsTab({
  orgSlug,
  orgId,
  canEdit,
}: {
  orgSlug: string;
  orgId: string;
  canEdit: boolean;
}) {
  const supabase = await createClient();
  const [members, { data: settings }, { data: digest }] = await Promise.all([
    listOrgMembers(orgId),
    supabase
      .from("alert_settings")
      .select(
        "enabled, notify_new_irregulars, notify_ca, notify_replacements, notify_trainings, notify_stock, notify_signatures",
      )
      .eq("organization_id", orgId)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("user_id, daily_digest")
      .eq("organization_id", orgId),
  ]);
  const digestByUser = new Map(
    (digest ?? []).map((d) => [d.user_id, d.daily_digest] as const),
  );
  return (
    <AlertSettingsPanel
      orgSlug={orgSlug}
      canEdit={canEdit}
      settings={settings ?? DEFAULT_ALERT_SETTINGS}
      members={members.map((m) => ({
        userId: m.user_id,
        email: m.email,
        role: m.role,
        dailyDigest: digestByUser.get(m.user_id) ?? false,
      }))}
    />
  );
}

async function StructureTab({
  orgSlug,
  orgId,
  canEdit,
}: {
  orgSlug: string;
  orgId: string;
  canEdit: boolean;
}) {
  const [units, sectors] = await Promise.all([
    listUnits(orgId),
    listSectors(orgId),
  ]);

  return (
    <>
      <Panel className="animate-fade-up">
        <PanelHeader
          title="Unidades"
          description="Filiais ou plantas. Opcional para empresas com um só endereço."
          actions={
            canEdit && (
              <DialogForm
                trigger={
                  <Button size="sm" variant="outline" className="rounded-full">
                    <Plus /> Unidade
                  </Button>
                }
                title="Nova unidade"
                fields={[
                  {
                    name: "name",
                    label: "Nome",
                    required: true,
                    placeholder: "Ex.: Matriz, Planta 2",
                  },
                ]}
                submitLabel="Criar"
                successMessage="Unidade criada"
                action={createUnit.bind(null, orgSlug)}
              />
            )
          }
        />
        {units.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm sm:px-5">
            Nenhuma unidade cadastrada.
          </p>
        ) : (
          <ul>
            {units.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
              >
                <Building2
                  className="text-primary size-5 shrink-0"
                  aria-hidden="true"
                />
                <span className="flex-1 font-medium">{u.name}</span>
                {canEdit && (
                  <ConfirmDialog
                    trigger={
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={`Arquivar ${u.name}`}
                      >
                        <Archive />
                      </Button>
                    }
                    title={`Arquivar a unidade ${u.name}?`}
                    description="Ela deixa de aparecer nos cadastros. Registros existentes não mudam."
                    confirmLabel="Arquivar"
                    successMessage="Unidade arquivada"
                    action={archiveUnit.bind(null, orgSlug, u.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="animate-fade-up">
        <PanelHeader
          title="Setores"
          description="Usados para filtrar funcionários e relatórios de custo."
          actions={
            canEdit && (
              <DialogForm
                trigger={
                  <Button size="sm" variant="outline" className="rounded-full">
                    <Plus /> Setor
                  </Button>
                }
                title="Novo setor"
                fields={[
                  {
                    name: "name",
                    label: "Nome",
                    required: true,
                    placeholder: "Ex.: Solda, Pintura",
                  },
                  ...(units.length
                    ? [
                        {
                          name: "unitId",
                          label: "Unidade",
                          type: "select" as const,
                          options: units.map((u) => ({
                            value: u.id,
                            label: u.name,
                          })),
                        },
                      ]
                    : []),
                ]}
                submitLabel="Criar"
                successMessage="Setor criado"
                action={createSector.bind(null, orgSlug)}
              />
            )
          }
        />
        {sectors.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm sm:px-5">
            Nenhum setor cadastrado.
          </p>
        ) : (
          <ul>
            {sectors.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
              >
                <Layers
                  className="text-primary size-5 shrink-0"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{s.name}</span>
                  {s.units?.name && (
                    <span className="text-muted-foreground text-sm">
                      {" "}
                      · {s.units.name}
                    </span>
                  )}
                </span>
                {canEdit && (
                  <ConfirmDialog
                    trigger={
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={`Arquivar ${s.name}`}
                      >
                        <Archive />
                      </Button>
                    }
                    title={`Arquivar o setor ${s.name}?`}
                    description="Ele deixa de aparecer nos cadastros. Funcionários deste setor continuam vinculados."
                    confirmLabel="Arquivar"
                    successMessage="Setor arquivado"
                    action={archiveSector.bind(null, orgSlug, s.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

async function TeamTab({
  orgSlug,
  orgId,
  canEdit,
  currentUserId,
}: {
  orgSlug: string;
  orgId: string;
  canEdit: boolean;
  currentUserId: string;
}) {
  const [members, invites] = await Promise.all([
    listOrgMembers(orgId),
    listPendingInvites(orgId),
  ]);
  const roleOptions = (Object.keys(ROLE_LABELS) as OrgRole[]).map((r) => ({
    value: r,
    label: `${ROLE_LABELS[r]} — ${ROLE_DESCRIPTIONS[r]}`,
  }));

  return (
    <Panel className="animate-fade-up">
      <PanelHeader
        title="Equipe"
        description="Pessoas com acesso a esta organização e o que cada uma pode fazer."

        actions={
          canEdit && (
            <InviteDialog orgSlug={orgSlug} roleOptions={roleOptions} />
          )
        }
      />
      <ul>
        {members.map((m) => (
          <li
            key={m.user_id}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
          >
            <AvatarInitials
              name={m.email.replace(/@.*/, "").replace(/[._-]/g, " ")}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">
                {m.email}
                {m.user_id === currentUserId && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    (você)
                  </span>
                )}
              </p>
              <p className="text-muted-foreground truncate text-sm">
                {ROLE_LABELS[m.role]} · desde {formatDate(m.created_at)}
              </p>
            </div>
            {canEdit && m.user_id !== currentUserId && (
              <div className="flex gap-1">
                <DialogForm
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      aria-label={`Alterar papel de ${m.email}`}
                    >
                      <Pencil />
                    </Button>
                  }
                  title="Alterar papel"
                  description={m.email}
                  fields={[
                    {
                      name: "role",
                      label: "Papel",
                      type: "select",
                      required: true,
                      defaultValue: m.role,
                      options: roleOptions,
                    },
                  ]}
                  submitLabel="Salvar"
                  successMessage="Papel atualizado"
                  action={changeMemberRole.bind(null, orgSlug, m.user_id)}
                />
                <ConfirmDialog
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      aria-label={`Remover ${m.email}`}
                    >
                      <UserX />
                    </Button>
                  }
                  title="Remover da organização?"
                  description={`${m.email} perde o acesso imediatamente. O histórico de ações dessa pessoa é mantido.`}
                  confirmLabel="Remover"
                  destructive
                  successMessage="Membro removido"
                  action={removeMember.bind(null, orgSlug, m.user_id)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {invites.length > 0 && (
        <>
          <p className="text-muted-foreground border-t px-4 pt-3 text-xs font-bold tracking-wide uppercase sm:px-5">
            Convites pendentes
          </p>
          <ul>
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 px-4 py-3 sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {inv.email}
                  </span>
                  <span className="text-muted-foreground block text-sm">
                    {ROLE_LABELS[inv.role]} · vence {formatDate(inv.expires_at)}
                  </span>
                </span>
                {canEdit && (
                  <ConfirmDialog
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                      >
                        Cancelar
                      </Button>
                    }
                    title="Cancelar convite?"
                    description={`O link enviado para ${inv.email} deixa de funcionar.`}
                    confirmLabel="Cancelar convite"
                    successMessage="Convite cancelado"
                    action={revokeInvite.bind(null, orgSlug, inv.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

async function LocationsPanel({
  orgSlug,
  orgId,
  canEdit,
}: {
  orgSlug: string;
  orgId: string;
  canEdit: boolean;
}) {
  const locations = await listLocations(orgId);
  return (
    <Panel className="animate-fade-up">
      <PanelHeader
        title="Locais de estoque"
        description="Almoxarifados com saldo próprio. A maioria das empresas usa só o principal."
        actions={
          canEdit && (
            <DialogForm
              trigger={
                <Button size="sm" variant="outline" className="rounded-full">
                  <Plus /> Local
                </Button>
              }
              title="Novo local de estoque"
              fields={[
                {
                  name: "name",
                  label: "Nome",
                  required: true,
                  placeholder: "Ex.: Almoxarifado Planta 2",
                },
              ]}
              submitLabel="Criar"
              successMessage="Local criado"
              action={createLocation.bind(null, orgSlug)}
            />
          )
        }
      />
      <ul>
        {locations.map((l) => (
          <li
            key={l.id}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
          >
            <Warehouse
              className="text-primary size-5 shrink-0"
              aria-hidden="true"
            />
            <span className="flex-1 font-medium">
              {l.name}
              {l.is_default && (
                <span className="text-muted-foreground text-sm font-normal">
                  {" "}
                  · padrão
                </span>
              )}
            </span>
            {canEdit && !l.is_default && (
              <ConfirmDialog
                trigger={
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full"
                    aria-label={`Arquivar ${l.name}`}
                  >
                    <Archive />
                  </Button>
                }
                title={`Arquivar ${l.name}?`}
                description="Só é possível arquivar locais sem saldo. O histórico de movimentações é mantido."
                confirmLabel="Arquivar"
                successMessage="Local arquivado"
                action={archiveLocation.bind(null, orgSlug, l.id)}
              />
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
