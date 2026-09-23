import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/shared/auth-shell";
import { CreateOrganizationForm } from "@/features/organizations/components/CreateOrganizationForm";

export const metadata: Metadata = { title: "Nova organização — Almox SST" };

export default function NewOrganizationPage() {
  return (
    <AuthShell
      title="Nova organização"
      description="Crie outra organização — por exemplo, se você atende mais de uma empresa como técnico de segurança."
      footer={
        <Link
          href="/"
          className="hover:text-foreground inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
      }
    >
      <CreateOrganizationForm />
    </AuthShell>
  );
}
