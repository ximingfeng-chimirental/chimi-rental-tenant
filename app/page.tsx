import { redirect } from "next/navigation";
import { auth0 } from "@/app/lib/auth0";
import TenantPortalDashboard from "@/app/components/TenantPortalDashboard";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    payment_status?: string;
    charge_id?: string;
  }>;
}) {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/api/auth/login?returnTo=/");
  }

  
  const resolvedSearchParams = await searchParams;
  return (
    <TenantPortalDashboard
      fetchUrl="/api/tenant-portal/me"
      paymentStatus={resolvedSearchParams.payment_status ?? null}
      paymentChargeId={resolvedSearchParams.charge_id ?? null}
    />
  );
}
