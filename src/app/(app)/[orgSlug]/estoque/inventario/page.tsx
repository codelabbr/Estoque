import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getOrgContext } from "@/lib/org";
import { canOperateStock } from "@/lib/permissions";
import { formatDate, todayInSaoPaulo } from "@/lib/format";
import { getStockPosition, resolveLocation } from "@/features/stock/queries";
import { InventoryForm } from "@/features/stock/components/InventoryForm";
import { ClipboardList } from "lucide-react";

export const metadata: Metadata = { title: "Inventário — Almox SST" };

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ local?: string }>;
}) {
  const { orgSlug } = await params;
  const { local } = await searchParams;
  const { org, role } = await getOrgContext(orgSlug);
  if (!canOperateStock(role)) redirect(`/${orgSlug}/estoque`);
  const { current } = await resolveLocation(org.id, local);
  const position = current ? await getStockPosition(org.id, current.id) : [];
  const backHref = `/${orgSlug}/estoque${local ? `?local=${local}` : ""}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Inventário"
        description={current ? `Contagem física · ${current.name}` : undefined}
        backHref={backHref}
      />
      {position.length === 0 || !current ? (
        <EmptyState
          icon={ClipboardList}
          title="Nada para contar"
          description="Cadastre EPIs e registre entradas primeiro."
        />
      ) : (
        <InventoryForm
          orgSlug={orgSlug}
          locationId={current.id}
          position={position}
          defaultReason={`Inventário ${formatDate(todayInSaoPaulo())}`}
          backHref={backHref}
        />
      )}
    </div>
  );
}
