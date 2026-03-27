import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTenant } from "@/app/lib/tenant-auth";
import ChargeModel from "@/app/models/charge.model";
import ChargePaymentModel from "@/app/models/charge-payment.model";
import LeaseModel from "@/app/models/lease.model";
import User from "@/app/models/user.model";
import stripe, { calculateConvenienceFee } from "@/app/lib/stripe";
import "@/app/models/charge-category.model";

const PAYABLE_STATUSES = ["unpaid", "partial", "overdue"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { chargeId, chargeIds: rawChargeIds, paymentMethod = "card" } = body;

  // Support both single chargeId and array chargeIds
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

  const { tenant, error } = await getAuthenticatedTenant(req);
  if (error || !tenant) {
    return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the tenant's active leases to verify they can pay these charges
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

  // Validate all charges are payable
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

  // Cancel any existing in-flight payments for these charges
  for (const charge of charges) {
    const existingInFlightPayment = await ChargePaymentModel.findOne({
      owner: tenant.owner,
      tenant: tenant._id,
      status: { $in: ["pending", "processing"] },
      "chargesApplied.chargeId": charge._id,
    }).select("_id status stripe.paymentIntentId");

    if (existingInFlightPayment) {
      if (existingInFlightPayment.status === "processing") {
        return NextResponse.json(
          { error: `A payment for "${charge.title}" is already processing.` },
          { status: 409 }
        );
      }
      try {
        const piId = existingInFlightPayment.stripe?.paymentIntentId;
        if (piId) await stripe.paymentIntents.cancel(piId);
      } catch {
        // Stripe cancel failed — still clean up local record
      }
      await ChargePaymentModel.deleteOne({ _id: existingInFlightPayment._id });
    }
  }

  const owner = await User.findById(tenant.owner).select(
    "stripeConnect paymentSettings"
  );
  if (!owner) {
    return NextResponse.json({ error: "Landlord not found" }, { status: 404 });
  }

  const convenienceFeePaidBy: "tenant" | "landlord" =
    owner.paymentSettings?.convenienceFeePaidBy ?? "tenant";
  const method: "card" | "ach" =
    paymentMethod === "ach" ? "ach" : "card";
  const stripePaymentMethodType =
    method === "ach" ? "us_bank_account" : "card";

  // Calculate totals across all charges
  const subtotal = charges.reduce((sum, c) => sum + c.balance, 0);
  const convenienceFee = calculateConvenienceFee(subtotal, method);
  const tenantPays =
    convenienceFeePaidBy === "tenant"
      ? subtotal + convenienceFee
      : subtotal;

  const amountCents = Math.round(tenantPays * 100);
  const convenienceFeeCents = Math.round(convenienceFee * 100);
  const stripeAccountId: string | undefined =
    owner.stripeConnect?.accountId ?? undefined;
  const chargesEnabled: boolean =
    owner.stripeConnect?.chargesEnabled ?? false;

  const chargesApplied = charges.map((c) => ({
    chargeId: c._id,
    amountApplied: c.balance,
  }));

  const paymentIntentParams: Record<string, unknown> = {
    amount: amountCents,
    currency: "usd",
    payment_method_types: [stripePaymentMethodType],
    metadata: {
      chargeIds: chargeIds.join(","),
      tenantId: String(tenant._id),
      ownerId: String(tenant.owner),
      convenienceFeeCents: String(convenienceFeeCents),
      convenienceFeePaidBy,
      paymentMethod: method,
    },
  };

  if (stripeAccountId && chargesEnabled) {
    paymentIntentParams.on_behalf_of = stripeAccountId;
    paymentIntentParams.transfer_data = { destination: stripeAccountId };
    if (convenienceFeePaidBy === "tenant") {
      paymentIntentParams.application_fee_amount = convenienceFeeCents;
    }
  }

  const paymentIntent = await stripe.paymentIntents.create(
    paymentIntentParams as never
  );

  await ChargePaymentModel.create({
    owner: tenant.owner,
    tenant: tenant._id,
    propertyUnit: charges[0].propertyUnit,
    chargesApplied,
    subtotal,
    convenienceFee,
    feePaidBy: convenienceFeePaidBy,
    totalCharged: tenantPays,
    netToLandlord: subtotal,
    paymentMethod: method,
    stripe: { paymentIntentId: paymentIntent.id },
    status: "pending",
  });

  const chargeName =
    charges.length === 1
      ? charges[0].title
      : `${charges.length} charges`;

  return NextResponse.json({
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    amountCents,
    convenienceFeeCents,
    convenienceFeePaidBy,
    chargeName,
  });
}
