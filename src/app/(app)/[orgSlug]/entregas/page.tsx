import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, HardHat, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { SearchInput } from "@/components/shared/search-input";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { Pagination, pageFromParams } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { getOrgContext } from "@/lib/org";
import { canOperateStock } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import {
  countPendingSignatures,
  listDeliveries,
  type DeliveryFilter,
} from "@/features/deliveries/queries";
import { SIGNATURE_STATUS } from "@/features/deliveries/constants";

export const metadata: Metadata = { title: "Entregas — Almox SST" };

const FILTERS: { value: DeliveryFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendentes", label: "Aguardando assinatura" },
  { value: "assinadas", label: "Assinadas" },
  { value: "canceladas", label: "Canceladas" },
];

export default async function DeliveriesPage({
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
    "todas") as DeliveryFilter;
  const page = pageFromParams(sp.page);
  const [{ rows, total }, pending] = await Promise.all([
    listDeliveries(org.id, { filter, page, q: sp.q }),
    countPendingSignatures(org.id),
  ]);
  const canOperate = canOperateStock(role);

  const href = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = {
      q: sp.q,
      filtro: filter === "todas" ? undefined : filter,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/${orgSlug}/entregas${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Entregas"
        description="Fichas de EPI com assinatura do funcionário."
        actions={
          canOperate && (
            <Button asChild className="rounded-full px-5 font-bold">
              <Link href={`/${orgSlug}/entregas/nova`}>
                <Plus /> Nova entrega
              </Link>
            </Button>
          )
        }
      />
      <Panel className="animate-fade-up">
        <div className="border-b px-4 py-3 sm:px-5">
          <SearchInput placeholder="Buscar por funcionário" />
        </div>
        <FilterTabs
          items={FILTERS.map((f) =>
            f.value === "pendentes" ? { ...f, count: pending } : f,
          )}
          current={filter}
          hrefFor={(v) =>
            href({ filtro: v === "todas" ? undefined : v, page: undefined })
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={HardHat}
            className="rounded-none border-0"
            title={
              sp.q || filter !== "todas"
                ? "Nenhuma entrega encontrada"
                : "Nenhuma entrega registrada"
            }
            description={
              sp.q || filter !== "todas"
                ? "Tente outra busca ou filtro."
                : "Registre a primeira entrega no balcão. Leva menos de 30 segundos."
            }
            action={
              !sp.q && filter === "todas" && canOperate ? (
                <Button asChild className="rounded-full font-bold">
                  <Link href={`/${orgSlug}/entregas/nova`}>
                    Registrar entrega
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul>
            {rows.map((d) => {
              const status = SIGNATURE_STATUS[d.signature_status];
              const items = d.epi_delivery_items
                .map(
                  (i) =>
                    `${i.quantity}× ${i.epi_name_snapshot} ${i.size_label_snapshot}`,
                )
                .join(", ");
              return (
                <li key={d.id} className="border-b last:border-b-0">
                  <Link
                    href={`/${orgSlug}/entregas/${d.id}`}
                    className="hover:bg-foreground/[0.03] flex items-center gap-3 px-4 py-3 transition-colors sm:px-5"
                  >
                    <AvatarInitials
                      name={d.employee_name_snapshot}
                      muted={d.signature_status === "cancelada"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-bold">
                          {d.employee_name_snapshot}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {" "}
                          · {formatDateTime(d.delivered_at)}
                        </span>
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {items}
                      </p>
                    </div>
                    <StatusBadge
                      status={status.status}
                      label={status.label}
                      className="hidden sm:inline-flex"
                    />
                    <ChevronRight
                      className="text-muted-foreground size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          page={page}
          total={total}
          hrefFor={(p) => href({ page: p > 1 ? String(p) : undefined })}
        />
      </Panel>
      {canOperate && (
        <Link
          href={`/${orgSlug}/entregas/nova`}
          className="bg-primary text-primary-foreground fixed right-4 bottom-5 z-30 flex size-14 items-center justify-center rounded-full shadow-lg sm:hidden"
          aria-label="Nova entrega"
        >
          <Plus className="size-6" />
        </Link>
      )}
    </>
  );
}
