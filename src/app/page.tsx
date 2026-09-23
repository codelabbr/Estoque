import { redirect } from "next/navigation";
import { listMyOrganizations } from "@/features/organizations/queries";

export default async function RootPage() {
  const orgs = await listMyOrganizations();

  if (orgs.length === 0) {
    redirect("/onboarding");
  }

  redirect(`/${orgs[0].slug}/dashboard`);
}
