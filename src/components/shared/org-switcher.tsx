"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { MyOrganization } from "@/features/organizations/queries";

function orgInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function OrgSwitcher({
  organizations,
  currentSlug,
}: {
  organizations: MyOrganization[];
  currentSlug: string;
}) {
  const router = useRouter();
  const current = organizations.find((o) => o.slug === currentSlug);
  const name = current?.name ?? currentSlug;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label="Selecionar organização"
              tooltip={name}
              className="data-[state=open]:bg-sidebar-accent"
            >
              <span className="bg-primary/10 text-primary ring-primary/15 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ring-1">
                {orgInitials(name)}
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  Organização
                </span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Suas organizações
            </DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onSelect={() => router.push(`/${org.slug}/dashboard`)}
              >
                <Building2 className="size-4 opacity-60" />
                <span className="flex-1 truncate">{org.name}</span>
                {org.slug === currentSlug && (
                  <Check className="text-primary size-4" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/organizacoes/nova">
                <Plus className="size-4" />
                Nova organização
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
