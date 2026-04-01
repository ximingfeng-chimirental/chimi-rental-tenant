import { model, models, Schema } from "mongoose";

const UserSchema = new Schema(
  {
    auth0Id: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
    },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    role: {
      type: String,
      enum: ["admin", "tenant", "landlord"],
      default: "landlord",
    },
    stripeConnect: {
      accountId: { type: String, default: null },
      chargesEnabled: { type: Boolean, default: false },
      payoutsEnabled: { type: Boolean, default: false },
    },
    paymentSettings: {
      achFeePaidBy: {
        type: String,
        enum: ["tenant", "landlord"],
        default: "landlord",
      },
      cardFeePaidBy: {
        type: String,
        enum: ["tenant", "landlord"],
        default: "tenant",
      },
    },
  },
  { timestamps: true }
);

const User = models.users || model("users", UserSchema);

export default User;
