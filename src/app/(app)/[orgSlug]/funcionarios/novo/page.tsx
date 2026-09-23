import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { getEmployeeFormOptions } from "@/features/employees/queries";
import { EmployeeForm } from "@/features/employees/components/EmployeeForm";

export const metadata: Metadata = { title: "Novo funcionário — Almox SST" };

export default async function NewEmployeePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org, role } = await getOrgContext(orgSlug);
  if (!canManageRegistry(role)) redirect(`/${orgSlug}/funcionarios`);
  const options = await getEmployeeFormOptions(org.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Novo funcionário"
        backHref={`/${orgSlug}/funcionarios`}
      />
      <EmployeeForm orgSlug={orgSlug} options={options} />
    </div>
  );
}
