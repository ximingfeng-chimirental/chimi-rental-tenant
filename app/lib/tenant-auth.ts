import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import { auth0 } from "@/app/lib/auth0";
import Tenant from "@/app/models/tenant.model";

export async function getAuthenticatedTenant() {
  const session = await auth0.getSession();
  const auth0UserId = session?.user?.sub;
  const sessionEmail = session?.user?.email ?? null;
  const emailVerified = Boolean(session?.user?.email_verified);

  if (!auth0UserId) {
    return {
      tenant: null,
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  await dbConnect();

  const tenant = await Tenant.findOne({
    auth0UserId,
    portalAccessStatus: { $ne: "disabled" },
  });

  if (tenant) {
    return { tenant, session, error: null };
  }

  if (!sessionEmail) {
    return {
      tenant: null,
      session,
      error: NextResponse.json(
        { error: "Tenant portal access not linked" },
        { status: 403 }
      ),
    };
  }

  const emailRegex = new RegExp(`^${sessionEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const emailMatchedTenants = await Tenant.find({
    email: emailRegex,
    portalAccessStatus: { $ne: "disabled" },
    endDate: null,
  });

  if (emailMatchedTenants.length === 1) {
    const matchedTenant = emailMatchedTenants[0];
    matchedTenant.auth0UserId = auth0UserId;
    matchedTenant.portalAccessStatus = "linked";
    matchedTenant.portalLinkedAt = matchedTenant.portalLinkedAt ?? new Date();
    matchedTenant.portalLastLoginAt = new Date();
    matchedTenant.portalEmailVerified = emailVerified;
    await matchedTenant.save();

    return { tenant: matchedTenant, session, error: null };
  }

  if (emailMatchedTenants.length > 1) {
    return {
      tenant: null,
      session,
      error: NextResponse.json(
        {
          error:
            "Multiple tenant records match this email. Please contact support to finish linking your account.",
        },
        { status: 409 }
      ),
    };
  }

  return {
    tenant: null,
    session,
    error: NextResponse.json(
      { error: "No tenant record matched the signed-in email." },
      { status: 403 }
    ),
  };
}
