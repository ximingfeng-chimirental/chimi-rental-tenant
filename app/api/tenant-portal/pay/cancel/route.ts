import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTenant } from "@/app/lib/tenant-auth";
import ChargePaymentModel from "@/app/models/charge-payment.model";
import stripe from "@/app/lib/stripe";

export async function POST(req: NextRequest) {
  const { tenant, error } = await getAuthenticatedTenant(req);
  if (error || !tenant) {
    return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { paymentIntentId } = body;

  if (!paymentIntentId) {
    return NextResponse.json(
      { error: "paymentIntentId is required" },
      { status: 400 }
    );
  }

  const chargePayment = await ChargePaymentModel.findOne({
    owner: tenant.owner,
    tenant: tenant._id,
    "stripe.paymentIntentId": paymentIntentId,
  });

  if (!chargePayment) {
    return NextResponse.json({ success: true, skipped: true });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (
      ![
        "requires_payment_method",
        "requires_confirmation",
        "requires_action",
      ].includes(paymentIntent.status)
    ) {
      // PI has already progressed past cancelable state — don't touch the ChargePayment
      return NextResponse.json({
        success: true,
        skipped: true,
        status: paymentIntent.status,
      });
    }

    await stripe.paymentIntents.cancel(paymentIntentId);
  } catch {
    // Stripe cancel failed (e.g. already cancelled, expired, or network error)
    // Still clean up our local record so the tenant isn't stuck
  }

  await ChargePaymentModel.deleteOne({ _id: chargePayment._id });

  return NextResponse.json({ success: true });
}
