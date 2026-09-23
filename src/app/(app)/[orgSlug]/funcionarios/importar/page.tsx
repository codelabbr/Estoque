import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { ImportEmployees } from "@/features/employees/components/ImportEmployees";

export const metadata: Metadata = {
  title: "Importar funcionários — Almox SST",
};

export default async function ImportEmployeesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { role } = await getOrgContext(orgSlug);
  if (!canManageRegistry(role)) redirect(`/${orgSlug}/funcionarios`);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Importar funcionários"
        description="Traga a lista da folha de pagamento ou de uma planilha."
        backHref={`/${orgSlug}/funcionarios`}
      />
      <ImportEmployees orgSlug={orgSlug} />
    </div>
  );
}
