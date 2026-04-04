import { model, models, Schema } from "mongoose";

const ChargeAppliedSchema = new Schema(
  {
    chargeId: {
      type: Schema.Types.ObjectId,
      ref: "charges",
      required: true,
    },
    amountApplied: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const StripeInfoSchema = new Schema(
  {
    paymentIntentId: { type: String, default: null },
    chargeId: { type: String, default: null },
    transferId: { type: String, default: null },
    receiptUrl: { type: String, default: null },
  },
  { _id: false }
);

const ChargePaymentSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    tenant: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    propertyUnit: {
      type: Schema.Types.ObjectId,
      ref: "PropertyUnit",
      required: true,
    },
    chargesApplied: [ChargeAppliedSchema],
    subtotal: { type: Number, required: true },
    convenienceFee: { type: Number, default: 0 },
    feePaidBy: {
      type: String,
      enum: ["tenant", "landlord"],
      default: "tenant",
    },
    totalCharged: { type: Number, required: true },
    netToLandlord: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["ach", "card", "cash", "check", "other"],
      required: true,
    },
    stripe: {
      type: StripeInfoSchema,
      default: null,
    },
    status: {
      type: String,
      enum: [
        // New unified statuses
        "payment_submitted",
        "ach_debit_in_transit",
        "captured_by_platform",
        "held_on_connected_account",
        "available_on_connected_account",
        "payout_in_transit",
        "deposited_to_bank",
        "failed",
        "canceled",
        "refunded",
        "disputed",
        "payout_failed",
      ],
      default: "payment_submitted",
    },
    paidAt: { type: Date, default: null },
    initiatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ChargePaymentSchema.index(
  { "stripe.paymentIntentId": 1 },
  { sparse: true }
);
ChargePaymentSchema.index({ tenant: 1, createdAt: -1 });

const ChargePaymentModel =
  models.chargepayments || model("chargepayments", ChargePaymentSchema);

export default ChargePaymentModel;
