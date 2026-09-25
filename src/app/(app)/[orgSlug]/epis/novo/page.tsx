import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { EpiForm } from "@/features/epis/components/EpiForm";
import { listTrainingTypeOptions } from "@/features/structure/queries";

export const metadata: Metadata = { title: "Novo EPI — Almox SST" };

export default async function NewEpiPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org, role } = await getOrgContext(orgSlug);
  if (!canManageRegistry(role)) redirect(`/${orgSlug}/epis`);
  const trainingTypes = await listTrainingTypeOptions(org.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Novo EPI" backHref={`/${orgSlug}/epis`} />
      <EpiForm orgSlug={orgSlug} trainingTypes={trainingTypes} />
    </div>
  );
}
