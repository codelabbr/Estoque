"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { MyOrganization } from "@/features/organizations/queries";

export function OrgSwitcher({
  organizations,
  currentSlug,
}: {
  organizations: MyOrganization[];
  currentSlug: string;
}) {
  const router = useRouter();
  const current = organizations.find((o) => o.slug === currentSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          aria-label="Selecionar organização"
        >
          <span className="truncate">{current?.name ?? currentSlug}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => router.push(`/${org.slug}/dashboard`)}
          >
            <span className="flex-1 truncate">{org.name}</span>
            {org.slug === currentSlug && <Check className="size-4" />}
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
  );
}
