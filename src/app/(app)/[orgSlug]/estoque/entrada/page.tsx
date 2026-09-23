import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getOrgContext } from "@/lib/org";
import { canOperateStock } from "@/lib/permissions";
import { todayInSaoPaulo } from "@/lib/format";
import { listEpiOptions } from "@/features/epis/queries";
import { resolveLocation } from "@/features/stock/queries";
import { EntryForm } from "@/features/stock/components/EntryForm";
import { PackagePlus } from "lucide-react";

export const metadata: Metadata = { title: "Nova entrada — Almox SST" };

export default async function NewEntryPage({
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
  const [{ current }, epis] = await Promise.all([
    resolveLocation(org.id, local),
    listEpiOptions(org.id),
  ]);
  const backHref = `/${orgSlug}/estoque${local ? `?local=${local}` : ""}`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Nova entrada"
        description="Compra ou recebimento de EPIs."
        backHref={backHref}
      />
      {epis.length === 0 || !current ? (
        <EmptyState
          icon={PackagePlus}
          title="Cadastre um EPI primeiro"
          description="A entrada é feita por EPI e tamanho do catálogo."
          action={
            <Button asChild className="rounded-full font-bold">
              <Link href={`/${orgSlug}/epis/novo`}>Cadastrar EPI</Link>
            </Button>
          }
        />
      ) : (
        <EntryForm
          orgSlug={orgSlug}
          locationId={current.id}
          locationName={current.name}
          epis={epis}
          today={todayInSaoPaulo()}
          backHref={backHref}
        />
      )}
    </div>
  );
}
