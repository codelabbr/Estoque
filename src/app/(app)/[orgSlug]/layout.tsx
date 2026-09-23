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
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
