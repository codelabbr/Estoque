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
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { OrgSwitcher } from "@/components/shared/org-switcher";
import type { MyOrganization } from "@/features/organizations/queries";

type NavItem = {
  title: string;
  icon: typeof LayoutDashboard;
  href?: (orgSlug: string) => string;
  badge?: number;
};

const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, href: (s) => `/${s}/dashboard` },
  { title: "Entregas", icon: HardHat },
  { title: "Funcionários", icon: Users },
  { title: "EPIs", icon: ShieldCheck },
  { title: "Estoque", icon: Boxes },
  { title: "Treinamentos", icon: GraduationCap },
  { title: "Alertas", icon: Bell, badge: 0 },
  { title: "Relatórios", icon: FileBarChart },
  { title: "Configurações", icon: Settings },
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
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="p-2">
        <OrgSwitcher organizations={organizations} currentSlug={orgSlug} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const href = item.href?.(orgSlug);
                const isActive = !!href && pathname.startsWith(href);

                return (
                  <SidebarMenuItem key={item.title}>
                    {href ? (
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton
                        disabled
                        className="cursor-not-allowed opacity-50"
                        title="Em breve"
                      >
                        <item.icon />
                        <span>{item.title}</span>
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
      </SidebarContent>
    </Sidebar>
  );
}
