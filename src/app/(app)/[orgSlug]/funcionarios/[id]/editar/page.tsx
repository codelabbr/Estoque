import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { formatCpf } from "@/lib/validators";
import {
  getEmployee,
  getEmployeeFormOptions,
} from "@/features/employees/queries";
import { EmployeeForm } from "@/features/employees/components/EmployeeForm";

export const metadata: Metadata = { title: "Editar funcionário — Almox SST" };

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  const { org, role } = await getOrgContext(orgSlug);
  if (!canManageRegistry(role)) redirect(`/${orgSlug}/funcionarios/${id}`);
  const [employee, options] = await Promise.all([
    getEmployee(org.id, id),
    getEmployeeFormOptions(org.id),
  ]);
  if (!employee) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title={`Editar ${employee.full_name}`}
        backHref={`/${orgSlug}/funcionarios/${id}`}
      />
      <EmployeeForm
        orgSlug={orgSlug}
        employeeId={id}
        options={options}
        defaultValues={{
          fullName: employee.full_name,
          cpf: formatCpf(employee.cpf),
          registration: employee.registration ?? "",
          jobRoleId: employee.job_role_id ?? "",
          sectorId: employee.sector_id ?? "",
          unitId: employee.unit_id ?? "",
          phone: employee.phone ?? "",
          email: employee.email ?? "",
          hiredAt: employee.hired_at ?? "",
        }}
      />
    </div>
  );
}
