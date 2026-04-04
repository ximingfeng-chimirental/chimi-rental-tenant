import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTenant } from "@/app/lib/tenant-auth";
import ChargeModel from "@/app/models/charge.model";
import LeaseModel from "@/app/models/lease.model";
import User from "@/app/models/user.model";
import { calculateConvenienceFee } from "@/app/lib/stripe";
import "@/app/models/charge-category.model";

const PAYABLE_STATUSES = ["unpaid", "partial", "overdue"];

/**
 * Preview endpoint — returns fee breakdown and publishable key
 * without creating a PaymentIntent or ChargePayment record.
 * Used to initialize Stripe Elements in deferred intent mode.
 */
export async function POST(req: NextRequest) {
  const { tenant, error } = await getAuthenticatedTenant(req);
  if (error || !tenant) {
    return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { chargeId, chargeIds: rawChargeIds, paymentMethod = "card" } = body;

  const chargeIds: string[] = rawChargeIds?.length
    ? rawChargeIds
    : chargeId
    ? [chargeId]
    : [];

  if (chargeIds.length === 0) {
    return NextResponse.json(
      { error: "chargeId or chargeIds is required" },
      { status: 400 }
    );
  }

  const tenantLeases = await LeaseModel.find({
    tenants: tenant._id,
    owner: tenant.owner,
  }).select("_id").lean();
  const leaseIds = tenantLeases.map((l) => l._id);

  const charges = await ChargeModel.find({
    _id: { $in: chargeIds },
    lease: { $in: leaseIds },
    owner: tenant.owner,
  });

  if (charges.length === 0) {
    return NextResponse.json({ error: "No charges found" }, { status: 404 });
  }
  if (charges.length !== chargeIds.length) {
    return NextResponse.json(
      { error: `Only ${charges.length} of ${chargeIds.length} charges found` },
      { status: 404 }
    );
  }

  for (const charge of charges) {
    if (!PAYABLE_STATUSES.includes(charge.status)) {
      return NextResponse.json(
        { error: `Charge "${charge.title}" status "${charge.status}" is not payable` },
        { status: 422 }
      );
    }
    if (charge.balance <= 0) {
      return NextResponse.json(
        { error: `Charge "${charge.title}" has no outstanding balance` },
        { status: 422 }
      );
    }
  }

  const owner = await User.findById(tenant.owner).select(
    "stripeConnect paymentSettings"
  );
  if (!owner) {
    return NextResponse.json({ error: "Landlord not found" }, { status: 404 });
  }

  const method: "card" | "ach" =
    paymentMethod === "ach" ? "ach" : "card";
  const convenienceFeePaidBy: "tenant" | "landlord" =
    method === "ach"
      ? (owner.paymentSettings?.achFeePaidBy ?? "landlord")
      : (owner.paymentSettings?.cardFeePaidBy ?? "tenant");

  const subtotal = charges.reduce((sum, c) => sum + c.balance, 0);
  const convenienceFee = calculateConvenienceFee(subtotal, method, convenienceFeePaidBy);
  const tenantPays =
    convenienceFeePaidBy === "tenant"
      ? subtotal + convenienceFee
      : subtotal;

  const amountCents = Math.round(tenantPays * 100);
  const subtotalCents = Math.round(subtotal * 100);
  const convenienceFeeCents = Math.round(convenienceFee * 100);

  const chargeName =
    charges.length === 1
      ? charges[0].title
      : `${charges.length} charges`;

  return NextResponse.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    amountCents,
    subtotalCents,
    convenienceFeeCents,
    convenienceFeePaidBy,
    paymentMethod: method,
    chargeName,
  });
}
