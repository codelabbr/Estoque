import type { Metadata } from "next";
import { AuthShell } from "@/components/shared/auth-shell";
import { UpdatePasswordForm } from "@/features/auth/components/UpdatePasswordForm";

export const metadata: Metadata = { title: "Nova senha — Almox SST" };

export default function UpdatePasswordPage() {
  return (
    <AuthShell
      title="Escolha uma nova senha"
      description="Use pelo menos 8 caracteres. Você entrará automaticamente depois."
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
