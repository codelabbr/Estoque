import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { SearchInput } from "@/components/shared/search-input";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { Pagination, pageFromParams } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { CaBadge } from "@/components/shared/ca-badge";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { listEpis, type EpiFilter } from "@/features/epis/queries";
import { EPI_CATEGORY_LABELS } from "@/features/epis/constants";

export const metadata: Metadata = { title: "EPIs — Almox SST" };

const FILTERS: { value: EpiFilter; label: string }[] = [
  { value: "ativos", label: "Ativos" },
  { value: "ca_vencido", label: "CA vencido" },
  { value: "arquivados", label: "Arquivados" },
];

export default async function EpisPage({
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
    "ativos") as EpiFilter;
  const page = pageFromParams(sp.page);
  const { rows, total } = await listEpis(org.id, { q: sp.q, filter, page });

  const href = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = {
      q: sp.q,
      filtro: filter === "ativos" ? undefined : filter,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/${orgSlug}/epis${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="EPIs"
        description="Catálogo com CA, vida útil e tamanhos."
        actions={
          canManageRegistry(role) && (
            <Button asChild className="rounded-full px-5 font-bold">
              <Link href={`/${orgSlug}/epis/novo`}>
                <Plus /> Novo EPI
              </Link>
            </Button>
          )
        }
      />
      <Panel className="animate-fade-up">
        <div className="border-b px-4 py-3 sm:px-5">
          <SearchInput placeholder="Buscar por nome, CA ou fabricante" />
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
            icon={ShieldCheck}
            className="rounded-none border-0"
            title={
              sp.q || filter !== "ativos"
                ? "Nenhum EPI encontrado"
                : "Nenhum EPI cadastrado"
            }
            description={
              sp.q || filter !== "ativos"
                ? "Tente outra busca ou filtro."
                : "Cadastre os EPIs que a empresa fornece, com CA e tamanhos."
            }
            action={
              !sp.q && filter === "ativos" && canManageRegistry(role) ? (
                <Button asChild className="rounded-full font-bold">
                  <Link href={`/${orgSlug}/epis/novo`}>
                    Cadastrar o primeiro EPI
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul>
            {rows.map((epi) => (
              <li key={epi.id} className="border-b last:border-b-0">
                <Link
                  href={`/${orgSlug}/epis/${epi.id}`}
                  className="hover:bg-foreground/[0.03] flex items-center gap-3 px-4 py-3 transition-colors sm:px-5"
                >
                  <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                    <ShieldCheck className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{epi.name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {EPI_CATEGORY_LABELS[epi.category]}
                      {epi.ca_number && ` · CA ${epi.ca_number}`}
                      {epi.sizes.length > 0 && ` · ${epi.sizes.join(", ")}`}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <CaBadge
                      caNumber={epi.ca_number}
                      expiresAt={epi.ca_expires_at}
                      alertDays={org.alert_days_ca}
                      compact
                    />
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
        <Pagination
          page={page}
          total={total}
          hrefFor={(p) => href({ page: p > 1 ? String(p) : undefined })}
        />
      </Panel>
    </>
  );
}
