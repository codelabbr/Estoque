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
      { title: "Entregas", icon: HardHat },
      { title: "Estoque", icon: Boxes },
      { title: "Alertas", icon: Bell, badge: 0 },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Funcionários", icon: Users },
      { title: "EPIs", icon: ShieldCheck },
      { title: "Treinamentos", icon: GraduationCap },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Relatórios", icon: FileBarChart },
      { title: "Configurações", icon: Settings },
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
            <SidebarGroupLabel className="text-muted-foreground/80 text-[11px] font-semibold tracking-wider uppercase">
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
                          className="data-[active=true]:bg-sidebar-accent data-[active=true]:before:bg-primary relative h-9 font-medium transition-colors data-[active=true]:before:absolute data-[active=true]:before:inset-y-2 data-[active=true]:before:left-0 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full"
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
                          className="text-sidebar-foreground/50 hover:text-sidebar-foreground/50 h-9 cursor-not-allowed hover:bg-transparent"
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
