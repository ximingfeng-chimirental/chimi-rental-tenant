/**
 * POST /api/tenant-portal/pay/microdeposit-pending
 *
 * Called when confirmPayment returns requires_action with verify_with_microdeposits.
 * Saves the Stripe hosted verification URL and updates the payment status to microdeposit_pending.
 */
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import { getAuthenticatedTenant } from "@/app/lib/tenant-auth";
import ChargePaymentModel from "@/app/models/charge-payment.model";

export async function POST(req: NextRequest) {
  try {
    const { tenant, error } = await getAuthenticatedTenant(req);
    if (error || !tenant) {
      return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { paymentIntentId, verificationUrl } = await req.json();
    if (!paymentIntentId || !verificationUrl) {
      return NextResponse.json(
        { error: "paymentIntentId and verificationUrl are required" },
        { status: 400 }
      );
    }

    const payment = await ChargePaymentModel.findOne({
      "stripe.paymentIntentId": paymentIntentId,
      tenant: tenant._id,
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    await ChargePaymentModel.findByIdAndUpdate(payment._id, {
      $set: {
        status: "microdeposit_pending",
        "stripe.microDepositVerificationUrl": verificationUrl,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Microdeposit pending error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update payment" },
      { status: 500 }
    );
  }
}
