import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, ClipboardList, History, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { getOrgContext } from "@/lib/org";
import { canOperateStock } from "@/lib/permissions";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getStockPosition, resolveLocation } from "@/features/stock/queries";
import { stockStatus } from "@/features/stock/constants";
import { VariantStockActions } from "@/features/stock/components/VariantStockActions";
import { LocationSwitcher } from "@/features/stock/components/LocationSwitcher";

export const metadata: Metadata = { title: "Estoque — Almox SST" };

type Filter = "todos" | "abaixo" | "zerados";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "abaixo", label: "Abaixo do mínimo" },
  { value: "zerados", label: "Zerados" },
];

export default async function StockPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const { org, role } = await getOrgContext(orgSlug);
  const { locations, current } = await resolveLocation(org.id, sp.local);
  const filter = (FILTERS.find((f) => f.value === sp.filtro)?.value ??
    "todos") as Filter;
  const canOperate = canOperateStock(role);
  const position = current ? await getStockPosition(org.id, current.id) : [];

  const allVariants = position.flatMap((p) => p.variants);
  const below = allVariants.filter(
    (v) => v.balance > 0 && v.balance < v.minStock,
  ).length;
  const zeroed = allVariants.filter((v) => v.balance <= 0).length;
  const totalValue = allVariants.reduce(
    (sum, v) => sum + (v.avgCost ?? 0) * Math.max(v.balance, 0),
    0,
  );

  const visible = position
    .map((p) => ({
      ...p,
      variants: p.variants.filter((v) =>
        filter === "abaixo"
          ? v.balance > 0 && v.balance < v.minStock
          : filter === "zerados"
            ? v.balance <= 0
            : true,
      ),
    }))
    .filter((p) => p.variants.length > 0);

  const localParam =
    current && !current.is_default ? `local=${current.id}` : "";
  const withLocal = (path: string) =>
    `${path}${localParam ? `?${localParam}` : ""}`;

  return (
    <>
      <PageHeader
        title="Estoque"
        description={locations.length > 1 ? undefined : current?.name}
        actions={
          <>
            {locations.length > 1 && current && (
              <LocationSwitcher locations={locations} currentId={current.id} />
            )}
            <Button asChild variant="outline" className="rounded-full">
              <Link href={withLocal(`/${orgSlug}/estoque/movimentacoes`)}>
                <History /> Movimentações
              </Link>
            </Button>
            {canOperate && (
              <>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href={withLocal(`/${orgSlug}/estoque/inventario`)}>
                    <ClipboardList /> Inventário
                  </Link>
                </Button>
                <Button asChild className="rounded-full px-5 font-bold">
                  <Link href={withLocal(`/${orgSlug}/estoque/entrada`)}>
                    <PackagePlus /> Nova entrada
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />

      <dl className="animate-fade-up grid grid-cols-2 overflow-clip rounded-2xl border sm:grid-cols-4">
        {[
          {
            label: "Itens (EPI × tamanho)",
            value: formatNumber(allVariants.length),
          },
          { label: "Abaixo do mínimo", value: formatNumber(below) },
          { label: "Zerados", value: formatNumber(zeroed) },
          {
            label: "Valor em estoque",
            value: formatCurrency(totalValue),
            hint: "pelo custo médio",
          },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`px-4 py-4 sm:px-5 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}
          >
            <dt className="text-muted-foreground text-[13px]">{s.label}</dt>
            <dd className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">
              {s.value}
            </dd>
            {s.hint && (
              <dd className="text-muted-foreground text-xs">{s.hint}</dd>
            )}
          </div>
        ))}
      </dl>

      <Panel className="animate-fade-up">
        <FilterTabs
          items={FILTERS.map((f) => ({
            ...f,
            count:
              f.value === "abaixo"
                ? below
                : f.value === "zerados"
                  ? zeroed
                  : undefined,
          }))}
          current={filter}
          hrefFor={(v) => {
            const p = new URLSearchParams();
            if (v !== "todos") p.set("filtro", v);
            if (localParam) p.set("local", current!.id);
            const s = p.toString();
            return `/${orgSlug}/estoque${s ? `?${s}` : ""}`;
          }}
        />
        {visible.length === 0 ? (
          <EmptyState
            icon={Boxes}
            className="rounded-none border-0"
            title={
              position.length === 0 ? "Nenhum EPI no catálogo" : "Nada por aqui"
            }
            description={
              position.length === 0
                ? "Cadastre os EPIs e depois registre a primeira entrada de estoque."
                : filter === "abaixo"
                  ? "Nenhum item abaixo do estoque mínimo."
                  : "Nenhum item zerado."
            }
            action={
              position.length === 0 && canOperate ? (
                <Button asChild className="rounded-full font-bold">
                  <Link href={`/${orgSlug}/epis/novo`}>Cadastrar EPI</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul>
            {visible.map((p) => (
              <li key={p.epiId} className="border-b last:border-b-0">
                <div className="flex items-baseline justify-between gap-3 px-4 pt-3 sm:px-5">
                  <Link
                    href={`/${orgSlug}/epis/${p.epiId}`}
                    className="truncate font-bold hover:underline"
                  >
                    {p.epiName}
                  </Link>
                  {p.caNumber && (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      CA {p.caNumber}
                    </span>
                  )}
                </div>
                <ul className="pb-2">
                  {p.variants.map((v) => {
                    const status = stockStatus(v.balance, v.minStock);
                    return (
                      <li
                        key={v.id}
                        className="flex items-center gap-3 px-4 py-2 sm:px-5"
                      >
                        <span className="bg-muted flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-sm font-bold">
                          {v.sizeLabel}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px]">
                            <strong className="tabular-nums">
                              {formatNumber(v.balance)}
                            </strong>{" "}
                            {p.unit}
                            <span className="text-muted-foreground text-sm">
                              {" "}
                              · mín. {v.minStock}
                            </span>
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {v.avgCost != null &&
                              `Custo médio ${formatCurrency(v.avgCost)}`}
                            {v.avgCost != null && v.lastEntryOn && " · "}
                            {v.lastEntryOn &&
                              `Última entrada ${formatDate(v.lastEntryOn)}`}
                          </p>
                        </div>
                        <StatusBadge
                          status={status}
                          label={
                            v.balance <= 0
                              ? "Zerado"
                              : status === "atencao"
                                ? "Abaixo do mínimo"
                                : "Ok"
                          }
                          className="hidden sm:inline-flex"
                        />
                        {canOperate && current && (
                          <VariantStockActions
                            orgSlug={orgSlug}
                            locationId={current.id}
                            variantId={v.id}
                            label={`${p.epiName} ${v.sizeLabel}`}
                            balance={v.balance}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
