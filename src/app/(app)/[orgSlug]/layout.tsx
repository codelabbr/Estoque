import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { AppHeader } from "@/components/shared/app-header";
import { createClient } from "@/lib/supabase/server";
import { listMyOrganizations } from "@/features/organizations/queries";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const organizations = await listMyOrganizations();
  const currentOrg = organizations.find((o) => o.slug === orgSlug);

  if (!currentOrg) {
    redirect(
      organizations.length > 0
        ? `/${organizations[0].slug}/dashboard`
        : "/onboarding",
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar orgSlug={orgSlug} organizations={organizations} />
      <SidebarInset>
        <AppHeader
          orgName={currentOrg.name}
          orgSlug={orgSlug}
          userEmail={user.email ?? ""}
        />
        <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
