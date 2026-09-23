"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  HardHat,
  Users,
  ShieldCheck,
  Boxes,
  GraduationCap,
  Bell,
  FileBarChart,
  Settings,
  BriefcaseBusiness,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/shared/logo";
import { OrgSwitcher } from "@/components/shared/org-switcher";
import type { MyOrganization } from "@/features/organizations/queries";

type NavItem = {
  title: string;
  icon: typeof LayoutDashboard;
  href?: (orgSlug: string) => string;
  badge?: number;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operação",
    items: [
      {
        title: "Dashboard",
        icon: LayoutDashboard,
        href: (s) => `/${s}/dashboard`,
      },
      { title: "Entregas", icon: HardHat, href: (s) => `/${s}/entregas` },
      { title: "Estoque", icon: Boxes, href: (s) => `/${s}/estoque` },
      { title: "Alertas", icon: Bell, badge: 0 },
    ],
  },
  {
    label: "Cadastros",
    items: [
      {
        title: "Funcionários",
        icon: Users,
        href: (s) => `/${s}/funcionarios`,
      },
      { title: "EPIs", icon: ShieldCheck, href: (s) => `/${s}/epis` },
      { title: "Cargos", icon: BriefcaseBusiness, href: (s) => `/${s}/cargos` },
      { title: "Treinamentos", icon: GraduationCap },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Relatórios", icon: FileBarChart },
      {
        title: "Configurações",
        icon: Settings,
        href: (s) => `/${s}/configuracoes`,
      },
    ],
  },
];

export function AppSidebar({
  orgSlug,
  organizations,
}: {
  orgSlug: string;
  organizations: MyOrganization[];
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3">
        <Link
          href={`/${orgSlug}/dashboard`}
          aria-label="Almox SST — dashboard"
          className="w-fit overflow-hidden"
        >
          <Logo className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
        </Link>
      </SidebarHeader>
      <SidebarContent className="pt-2">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-muted-foreground px-3 text-[13px] font-bold">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const href = item.href?.(orgSlug);
                  const isActive = !!href && pathname.startsWith(href);

                  return (
                    <SidebarMenuItem key={item.title}>
                      {href ? (
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                          className="data-[active=true]:hover:bg-sidebar-accent h-11 gap-4 rounded-full px-3 text-[15px] font-medium transition-colors data-[active=true]:bg-transparent data-[active=true]:font-extrabold [&_svg]:size-5"
                        >
                          <Link href={href}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          aria-disabled="true"
                          tooltip={`${item.title} — em breve`}
                          className="text-sidebar-foreground/45 hover:text-sidebar-foreground/45 h-11 cursor-not-allowed gap-4 rounded-full px-3 text-[15px] hover:bg-transparent [&_svg]:size-5"
                        >
                          <item.icon />
                          <span>{item.title}</span>
                          <span className="bg-muted text-muted-foreground ml-auto rounded-full px-1.5 py-px text-[10px] font-medium group-data-[collapsible=icon]:hidden">
                            Em breve
                          </span>
                        </SidebarMenuButton>
                      )}
                      {typeof item.badge === "number" && item.badge > 0 && (
                        <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border border-t p-2">
        <OrgSwitcher organizations={organizations} currentSlug={orgSlug} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
