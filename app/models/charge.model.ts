import { model, models, Schema } from "mongoose";

const ChargeSchema = new Schema(
  {
    category: {
      type: Schema.Types.ObjectId,
      ref: "chargecategories",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    lease: {
      type: Schema.Types.ObjectId,
      ref: "leases",
      default: null,
    },
    propertyUnit: {
      type: Schema.Types.ObjectId,
      ref: "PropertyUnit",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balance: {
      type: Number,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["unpaid", "partial", "paid", "overdue", "voided", "waived"],
      default: "unpaid",
    },
    paidAt: {
      type: Date,
      default: null,
    },
    visibleDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

ChargeSchema.index({ lease: 1, status: 1 });
ChargeSchema.index({ lease: 1, dueDate: -1 });

const ChargeModel = models.charges || model("charges", ChargeSchema);

export default ChargeModel;
