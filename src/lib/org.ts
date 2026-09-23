import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/permissions";

export type OrgContext = {
  org: {
    id: string;
    name: string;
    slug: string;
    legal_name: string | null;
    cnpj: string | null;
    responsibility_term: string;
    alert_days_ca: number;
    alert_days_epi: number;
    alert_days_training: number;
    created_at: string;
  };
  role: OrgRole;
  user: { id: string; email: string };
};

/**
 * Resolve a organização da URL e o papel do usuário logado. Memoizado por
 * requisição (React cache), então layout, páginas e actions podem chamar à vontade.
 * A RLS continua sendo a garantia; isto é só para a UI e para obter o id.
 */
export const getOrgContext = cache(
  async (orgSlug: string): Promise<OrgContext> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: org } = await supabase
      .from("organizations")
      .select(
        "id, name, slug, legal_name, cnpj, responsibility_term, alert_days_ca, alert_days_epi, alert_days_training, created_at",
      )
      .eq("slug", orgSlug)
      .maybeSingle();
    if (!org) notFound();

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) notFound();

    return {
      org,
      role: membership.role,
      user: { id: user.id, email: user.email ?? "" },
    };
  },
);
