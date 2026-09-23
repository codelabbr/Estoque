import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/shared/auth-shell";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { safeNextPath } from "@/lib/url";

export const metadata: Metadata = { title: "Entrar — Almox SST" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);

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
      <LoginForm next={nextPath} />
    </AuthShell>
  );
}
