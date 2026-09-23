import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileUp, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { SearchInput } from "@/components/shared/search-input";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { Pagination, pageFromParams } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { StatusBadge } from "@/components/shared/status-badge";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { maskCpfPartial } from "@/lib/validators";
import { formatDate } from "@/lib/format";
import {
  listEmployees,
  type EmployeeFilter,
} from "@/features/employees/queries";

export const metadata: Metadata = { title: "Funcionários — Almox SST" };

const FILTERS: { value: EmployeeFilter; label: string }[] = [
  { value: "ativos", label: "Ativos" },
  { value: "desligados", label: "Desligados" },
  { value: "arquivados", label: "Arquivados" },
];

export default async function EmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const { org, role } = await getOrgContext(orgSlug);
  const filter = (FILTERS.find((f) => f.value === sp.filtro)?.value ??
    "ativos") as EmployeeFilter;
  const page = pageFromParams(sp.page);
  const { rows, total } = await listEmployees(org.id, {
    q: sp.q,
    filter,
    page,
    jobRoleId: sp.cargo,
  });
  const canEdit = canManageRegistry(role);

  const href = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = {
      q: sp.q,
      cargo: sp.cargo,
      filtro: filter === "ativos" ? undefined : filter,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/${orgSlug}/funcionarios${s ? `?${s}` : ""}`;
  };
  const searching = !!sp.q || filter !== "ativos" || !!sp.cargo;

  return (
    <>
      <PageHeader
        title="Funcionários"
        description="Quem recebe EPIs e treinamentos."
        actions={
          canEdit && (
            <>
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/${orgSlug}/funcionarios/importar`}>
                  <FileUp /> Importar
                </Link>
              </Button>
              <Button asChild className="rounded-full px-5 font-bold">
                <Link href={`/${orgSlug}/funcionarios/novo`}>
                  <Plus /> Novo funcionário
                </Link>
              </Button>
            </>
          )
        }
      />
      <Panel className="animate-fade-up">
        <div className="border-b px-4 py-3 sm:px-5">
          <SearchInput placeholder="Buscar por nome, CPF ou matrícula" />
        </div>
        <FilterTabs
          items={FILTERS}
          current={filter}
          hrefFor={(v) =>
            href({ filtro: v === "ativos" ? undefined : v, page: undefined })
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            className="rounded-none border-0"
            title={
              searching
                ? "Nenhum funcionário encontrado"
                : "Nenhum funcionário cadastrado"
            }
            description={
              searching
                ? "Tente outra busca ou filtro."
                : "Cadastre um por um ou importe uma planilha com nome e CPF."
            }
            action={
              !searching && canEdit ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href={`/${orgSlug}/funcionarios/importar`}>
                      Importar planilha
                    </Link>
                  </Button>
                  <Button asChild className="rounded-full font-bold">
                    <Link href={`/${orgSlug}/funcionarios/novo`}>
                      Cadastrar funcionário
                    </Link>
                  </Button>
                </div>
              ) : undefined
            }
          />
        ) : (
          <ul>
            {rows.map((e) => (
              <li key={e.id} className="border-b last:border-b-0">
                <Link
                  href={`/${orgSlug}/funcionarios/${e.id}`}
                  className="hover:bg-foreground/[0.03] flex items-center gap-3 px-4 py-3 transition-colors sm:px-5"
                >
                  <AvatarInitials
                    name={e.full_name}
                    muted={!!e.terminated_at || !!e.archived_at}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{e.full_name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {[
                        e.job_roles?.name ?? "Sem cargo",
                        e.sectors?.name,
                        e.registration && `Mat. ${e.registration}`,
                        maskCpfPartial(e.cpf),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {e.terminated_at && (
                    <span className="hidden sm:block">
                      <StatusBadge
                        status="pendente"
                        label={`Desligado em ${formatDate(e.terminated_at)}`}
                      />
                    </span>
                  )}
                  <ChevronRight
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          page={page}
          total={total}
          hrefFor={(p) => href({ page: p > 1 ? String(p) : undefined })}
        />
      </Panel>
    </>
  );
}
