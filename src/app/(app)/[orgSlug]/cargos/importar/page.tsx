import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { listJobRoleNames } from "@/features/structure/queries";
import { ImportJobRoles } from "@/features/structure/components/ImportJobRoles";

export const metadata: Metadata = { title: "Importar cargos — Almox SST" };

export default async function ImportJobRolesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org, role } = await getOrgContext(orgSlug);
  if (!canManageRegistry(role)) redirect(`/${orgSlug}/cargos`);
  const existing = await listJobRoleNames(org.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Importar cargos"
        description="Traga a lista de cargos de uma planilha. Depois monte a matriz de EPIs de cada um."
        backHref={`/${orgSlug}/cargos`}
      />
      <ImportJobRoles orgSlug={orgSlug} existingJobRoles={existing} />
    </div>
  );
}
