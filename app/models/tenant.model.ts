import { model, models, Schema } from "mongoose";

const TenantSchema = new Schema(
  {
    firstName: String,
    lastName: String,
    email: String,
    phoneNumber: String,
    buildiumTenantId: {
      type: String,
      default: null,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    propertyUnit: {
      type: Schema.Types.ObjectId,
      ref: "PropertyUnit",
      default: null,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    auth0UserId: {
      type: String,
      default: null,
      index: true,
    },
    portalAccessStatus: {
      type: String,
      enum: ["invited", "linked", "disabled"],
      default: "invited",
    },
    portalLinkedAt: {
      type: Date,
      default: null,
    },
    portalLastLoginAt: {
      type: Date,
      default: null,
    },
    portalEmailVerified: {
      type: Boolean,
      default: false,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Tenant = models.Tenant || model("Tenant", TenantSchema);

export default Tenant;
