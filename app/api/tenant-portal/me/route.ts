import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTenant } from "@/app/lib/tenant-auth";
import { buildTenantPortalSession } from "@/app/lib/tenant-portal-data";

export async function GET(req: NextRequest) {
  const { tenant, error } = await getAuthenticatedTenant(req);
  if (error || !tenant) {
    return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  tenant.portalLastLoginAt = new Date();
  await tenant.save();

  const payload = await buildTenantPortalSession({
    tenantId: String(tenant._id),
    ownerId: String(tenant.owner),
  });

  if (!payload) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
