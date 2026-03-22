import { models, model, Schema } from "mongoose";

const LeaseSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    propertyUnit: {
      type: Schema.Types.ObjectId,
      ref: "PropertyUnit",
      required: true,
    },
    tenants: [
      {
        type: Schema.Types.ObjectId,
        ref: "Tenant",
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "expired", "terminated"],
      default: "active",
    },
  },
  { timestamps: true }
);

LeaseSchema.index({ tenants: 1, status: 1 });

const LeaseModel = models.leases || model("leases", LeaseSchema);

export default LeaseModel;
