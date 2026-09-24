import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/shared/auth-shell";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = { title: "Entrar — Almox SST" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Bem-vindo de volta"
      description="Entre para acompanhar entregas, estoque e treinamentos."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link
            href="/cadastro"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Criar conta grátis
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
