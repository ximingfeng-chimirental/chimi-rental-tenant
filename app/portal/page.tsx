import { redirect } from "next/navigation";

export default async function PortalPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{
    payment_status?: string;
    charge_id?: string;
  }>;
}) {
  await _searchParams;
  redirect("/");
}
