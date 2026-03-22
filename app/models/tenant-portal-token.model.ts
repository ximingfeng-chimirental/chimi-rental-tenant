import { model, models, Schema } from "mongoose";

const TenantPortalTokenSchema = new Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  lastUsedAt: {
    type: Date,
    default: null,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const TenantPortalToken =
  models.tenant_portal_tokens ||
  model("tenant_portal_tokens", TenantPortalTokenSchema);

export default TenantPortalToken;
