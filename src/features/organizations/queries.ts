import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MyOrganization = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "safety" | "storekeeper" | "viewer";
};

/** Organizações das quais o usuário logado é membro, para o onboarding e o seletor de organização. */
export async function listMyOrganizations(): Promise<MyOrganization[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .filter((m) => m.organizations)
    .map((m) => ({
      id: m.organizations!.id,
      name: m.organizations!.name,
      slug: m.organizations!.slug,
      role: m.role,
    }));
}

export async function getOrganizationBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return null;
  return data;
}
