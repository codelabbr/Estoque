import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { EpiForm } from "@/features/epis/components/EpiForm";

export const metadata: Metadata = { title: "Novo EPI — Almox SST" };

export default async function NewEpiPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { role } = await getOrgContext(orgSlug);
  if (!canManageRegistry(role)) redirect(`/${orgSlug}/epis`);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Novo EPI" backHref={`/${orgSlug}/epis`} />
      <EpiForm orgSlug={orgSlug} />
    </div>
  );
}
