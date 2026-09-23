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
    <header className="bg-background/75 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-xl sm:px-6">
      <SidebarTrigger className="-ml-1.5" aria-label="Alternar menu lateral" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-muted-foreground max-w-[40vw] truncate">
              {orgName}
            </BreadcrumbPage>
          </BreadcrumbItem>
          {section && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">
                  {section}
                </BreadcrumbPage>
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
