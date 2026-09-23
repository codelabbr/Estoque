import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateOrganizationForm } from "@/features/organizations/components/CreateOrganizationForm";
import { listMyOrganizations } from "@/features/organizations/queries";

export const metadata: Metadata = { title: "Criar organização — Almox SST" };

export default async function OnboardingPage() {
  const orgs = await listMyOrganizations();
  if (orgs.length > 0) {
    redirect(`/${orgs[0].slug}/dashboard`);
  }

  return (
    <div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <div className="text-primary flex items-center gap-2">
        <ShieldCheck className="size-7" />
        <span className="text-lg font-semibold">Almox SST</span>
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Vamos criar sua organização</CardTitle>
            <CardDescription>
              Você poderá convidar outras pessoas e ajustar os dados depois.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateOrganizationForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
