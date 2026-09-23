import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, History } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { Pagination, pageFromParams } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { getOrgContext } from "@/lib/org";
import { canOperateStock } from "@/lib/permissions";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  listMovements,
  resolveLocation,
  type MovementFilter,
} from "@/features/stock/queries";
import { MOVEMENT_LABELS, REVERSIBLE_TYPES } from "@/features/stock/constants";
import { ReverseMovementButton } from "@/features/stock/components/ReverseMovementButton";

export const metadata: Metadata = { title: "Movimentações — Almox SST" };

const FILTERS: { value: MovementFilter; label: string }[] = [
  { value: "todos", label: "Todas" },
  { value: "entradas", label: "Entradas" },
  { value: "saidas", label: "Saídas" },
  { value: "ajustes", label: "Ajustes e estornos" },
];

export default async function MovementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const { org, role } = await getOrgContext(orgSlug);
  const { current } = await resolveLocation(org.id, sp.local);
  const filter = (FILTERS.find((f) => f.value === sp.filtro)?.value ??
    "todos") as MovementFilter;
  const page = pageFromParams(sp.page);
  const { rows, total } = await listMovements(org.id, {
    locationId: current?.id,
    filter,
    page,
  });
  const canOperate = canOperateStock(role);

  const href = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = {
      local: sp.local,
      filtro: filter === "todos" ? undefined : filter,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/${orgSlug}/estoque/movimentacoes${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Movimentações"
        description={current ? `Extrato do ${current.name}` : undefined}
        backHref={`/${orgSlug}/estoque${sp.local ? `?local=${sp.local}` : ""}`}
      />
      <Panel className="animate-fade-up">
        <FilterTabs
          items={FILTERS}
          current={filter}
          hrefFor={(v) =>
            href({ filtro: v === "todos" ? undefined : v, page: undefined })
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={History}
            className="rounded-none border-0"
            title="Nenhuma movimentação"
            description="Entradas, entregas, ajustes e descartes aparecem aqui."
          />
        ) : (
          <ol>
            {rows.map((m) => {
              const incoming = m.direction === 1;
              const epiName = m.epi_variants?.epis?.name ?? "EPI";
              const size = m.epi_variants?.size_label;
              const detail = [
                m.supplier,
                m.document_ref && `Doc. ${m.document_ref}`,
                m.reason,
                m.unit_cost != null &&
                  `${formatCurrency(Number(m.unit_cost))}/un`,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                      incoming
                        ? "bg-status-ok text-status-ok-foreground"
                        : "bg-status-irregular text-status-irregular-foreground"
                    }`}
                    aria-hidden="true"
                  >
                    {incoming ? (
                      <ArrowDownLeft className="size-5" />
                    ) : (
                      <ArrowUpRight className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-bold">
                        {MOVEMENT_LABELS[m.type]}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {epiName}
                        {size && ` ${size}`}
                      </span>
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      <time
                        dateTime={m.created_at}
                        title={formatDateTime(m.created_at)}
                      >
                        {formatDate(m.occurred_on)}
                      </time>
                      {detail && ` · ${detail}`}
                    </p>
                  </div>
                  {m.isReversed && (
                    <StatusBadge
                      status="pendente"
                      label="Estornado"
                      className="hidden sm:inline-flex"
                    />
                  )}
                  <span
                    className={`shrink-0 font-extrabold tabular-nums ${incoming ? "" : "text-muted-foreground"}`}
                  >
                    {incoming ? "+" : "−"}
                    {m.quantity}
                  </span>
                  {canOperate &&
                    REVERSIBLE_TYPES.includes(m.type) &&
                    !m.isReversed && (
                      <ReverseMovementButton
                        orgSlug={orgSlug}
                        movementId={m.id}
                        label={`${MOVEMENT_LABELS[m.type]} de ${m.quantity} × ${epiName}${size ? ` ${size}` : ""}`}
                      />
                    )}
                </li>
              );
            })}
          </ol>
        )}
        <Pagination
          page={page}
          total={total}
          hrefFor={(p) => href({ page: p > 1 ? String(p) : undefined })}
        />
      </Panel>
    </div>
  );
}
