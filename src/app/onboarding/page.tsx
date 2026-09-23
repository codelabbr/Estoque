import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/shared/auth-shell";
import { CreateOrganizationForm } from "@/features/organizations/components/CreateOrganizationForm";
import { listMyOrganizations } from "@/features/organizations/queries";

export const metadata: Metadata = { title: "Criar organização — Almox SST" };

export default async function OnboardingPage() {
  const orgs = await listMyOrganizations();
  if (orgs.length > 0) {
    redirect(`/${orgs[0].slug}/dashboard`);
  }

  return (
    <AuthShell
      title="Vamos criar sua organização"
      description="Você poderá convidar outras pessoas e ajustar os dados depois."
    >
      <CreateOrganizationForm />
    </AuthShell>
  );
}
