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

export async function listOrgMembers(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_org_members", {
    p_org: orgId,
  });
  if (error) throw error;
  return data;
}

export async function listPendingInvites(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_invites")
    .select("id, email, role, expires_at, created_at")
    .eq("organization_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) return [];
  return data;
}
