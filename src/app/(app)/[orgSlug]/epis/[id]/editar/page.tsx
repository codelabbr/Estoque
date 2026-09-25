import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getOrgContext } from "@/lib/org";
import { canManageRegistry } from "@/lib/permissions";
import { getEpi } from "@/features/epis/queries";
import { EpiForm } from "@/features/epis/components/EpiForm";
import { listTrainingTypeOptions } from "@/features/structure/queries";

export const metadata: Metadata = { title: "Editar EPI — Almox SST" };

export default async function EditEpiPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  const { org, role } = await getOrgContext(orgSlug);
  if (!canManageRegistry(role)) redirect(`/${orgSlug}/epis/${id}`);
  const [epi, trainingTypes] = await Promise.all([
    getEpi(org.id, id),
    listTrainingTypeOptions(org.id),
  ]);
  if (!epi) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title={`Editar ${epi.name}`}
        backHref={`/${orgSlug}/epis/${id}`}
      />
      <EpiForm
        orgSlug={orgSlug}
        epiId={id}
        trainingTypes={trainingTypes}
        defaultValues={{
          requiredTrainingTypeId: epi.required_training_type_id ?? "",
          name: epi.name,
          category: epi.category,
          manufacturer: epi.manufacturer ?? "",
          model: epi.model ?? "",
          caNumber: epi.ca_number ?? "",
          caExpiresAt: epi.ca_expires_at ?? "",
          unitOfMeasure: epi.unit_of_measure,
          lifespanDays: epi.lifespan_days ? String(epi.lifespan_days) : "",
          referenceCost:
            epi.reference_cost != null
              ? String(epi.reference_cost).replace(".", ",")
              : "",
        }}
      />
    </div>
  );
}
