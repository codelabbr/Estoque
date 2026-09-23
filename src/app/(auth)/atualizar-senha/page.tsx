import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/features/auth/components/UpdatePasswordForm";

export const metadata: Metadata = { title: "Nova senha — Almox SST" };

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
