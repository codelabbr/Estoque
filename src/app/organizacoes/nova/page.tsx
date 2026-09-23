import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateOrganizationForm } from "@/features/organizations/components/CreateOrganizationForm";

export const metadata: Metadata = { title: "Nova organização — Almox SST" };

export default function NewOrganizationPage() {
  return (
    <div className="mx-auto flex min-h-svh max-w-sm items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Nova organização</CardTitle>
          <CardDescription>
            Crie outra organização — por exemplo, se você atende mais de uma
            empresa como técnico de segurança.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrganizationForm />
        </CardContent>
      </Card>
    </div>
  );
}
