import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/shared/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Recuperar senha — Almox SST" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      description="Informe seu e-mail e enviaremos um link para você escolher uma nova senha."
      footer={
        <Link
          href="/login"
          className="hover:text-foreground inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar para o login
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
