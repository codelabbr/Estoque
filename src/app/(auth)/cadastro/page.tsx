import type { Metadata } from "next";
import { SignUpForm } from "@/features/auth/components/SignUpForm";

export const metadata: Metadata = { title: "Criar conta — Almox SST" };

export default function SignUpPage() {
  return <SignUpForm />;
}
