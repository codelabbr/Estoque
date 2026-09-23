import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { todayInSaoPaulo } from "@/lib/format";
import {
  listEmployeesForBatch,
  listTrainingTypes,
} from "@/features/trainings/queries";
import { BatchForm } from "@/features/trainings/components/BatchForm";

export const metadata: Metadata = {
  title: "Registrar treinamento — Almox SST",
};

export default async function RegisterTrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ tipo?: string; funcionario?: string }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const { org, role } = await getOrgContext(orgSlug);
  if (!canManageRegistry(role)) redirect(`/${orgSlug}/treinamentos`);
  const types = await listTrainingTypes(org.id);
  const typeId = types.some((t) => t.id === sp.tipo) ? sp.tipo : undefined;
  const employees = await listEmployeesForBatch(org.id, typeId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Registrar treinamento"
        description="Individual ou em turma: escolha o treinamento e os participantes."
        backHref={
          sp.funcionario
            ? `/${orgSlug}/funcionarios/${sp.funcionario}`
            : `/${orgSlug}/treinamentos`
        }
      />
      <BatchForm
        orgSlug={orgSlug}
        orgId={org.id}
        types={types.map((t) => ({
          ...t,
          workload_hours:
            t.workload_hours != null ? Number(t.workload_hours) : null,
        }))}
        employees={employees}
        selectedTypeId={typeId}
        preselectedEmployeeId={sp.funcionario}
        today={todayInSaoPaulo()}
      />
    </div>
  );
}
