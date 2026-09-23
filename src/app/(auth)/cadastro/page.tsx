import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/shared/auth-shell";
import { SignUpForm } from "@/features/auth/components/SignUpForm";

export const metadata: Metadata = { title: "Criar conta — Almox SST" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Crie sua conta"
      description="Comece a organizar EPIs, estoque e treinamentos da sua empresa."
      footer={
        <>
          Já tem conta?{" "}
          <Link
            href="/login"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
