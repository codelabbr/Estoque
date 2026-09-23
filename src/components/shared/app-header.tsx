"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  entregas: "Entregas",
  funcionarios: "Funcionários",
  epis: "EPIs",
  estoque: "Estoque",
  treinamentos: "Treinamentos",
  alertas: "Alertas",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
};

export function AppHeader({
  orgName,
  orgSlug,
  userEmail,
}: {
  orgName: string;
  orgSlug: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const rest = pathname.replace(`/${orgSlug}`, "").split("/").filter(Boolean);
  const section = rest[0] ? (SECTION_LABELS[rest[0]] ?? rest[0]) : null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-foreground font-medium">
              {orgName}
            </BreadcrumbPage>
          </BreadcrumbItem>
          {section && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{section}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserMenu email={userEmail} />
      </div>
    </header>
  );
}
