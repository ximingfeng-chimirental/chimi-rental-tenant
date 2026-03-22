import Tenant from "@/app/models/tenant.model";
import ChargeModel from "@/app/models/charge.model";
import ChargePaymentModel from "@/app/models/charge-payment.model";
import LeaseModel from "@/app/models/lease.model";
import "@/app/models/charge-category.model";
import "@/app/models/property-unit.model";
import "@/app/models/property.model";

export async function buildTenantPortalSession({
  tenantId,
  ownerId,
}: {
  tenantId: string;
  ownerId: string;
}) {
  const tenant = await Tenant.findById(tenantId).populate({
    path: "propertyUnit",
    populate: {
      path: "property",
      select: "addressLine1 addressLine2 city state zipCode",
    },
  });

  if (!tenant) {
    return null;
  }

  // Find leases where this tenant is included
  const leases = await LeaseModel.find({
    tenants: tenantId,
    owner: ownerId,
  })
    .select("_id")
    .lean();
  const leaseIds = leases.map((l) => l._id);

  // Only show charges that are already visible to the tenant:
  // - Non-recurring charges (visibleDate is null/missing) — always visible
  // - Recurring charges — visible once visibleDate <= now (typically 5 days before due)
  const now = new Date();
  const rawCharges = await ChargeModel.find({
    lease: { $in: leaseIds },
    owner: ownerId,
    $or: [
      { visibleDate: null },
      { visibleDate: { $exists: false } },
      { visibleDate: { $lte: now } },
    ],
  })
    .populate("category", "name")
    .sort({ dueDate: 1 })
    .lean();

  const statusOrder: Record<string, number> = {
    overdue: 0,
    unpaid: 1,
    partial: 2,
    paid: 3,
    waived: 4,
    voided: 5,
  };

  const charges = [...rawCharges].sort(
    (a, b) =>
      (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  const pendingPayments = await ChargePaymentModel.find({
    owner: ownerId,
    tenant: tenantId,
    status: { $in: ["pending", "processing"] },
    "chargesApplied.chargeId": { $in: charges.map((charge) => charge._id) },
  })
    .select("chargesApplied status paymentMethod createdAt")
    .lean();

  const pendingPaymentByChargeId = new Map<
    string,
    {
      status: "pending" | "processing";
      paymentMethod: string;
      createdAt: Date | null;
    }
  >();

  for (const payment of pendingPayments) {
    for (const applied of payment.chargesApplied ?? []) {
      const chargeId = String((applied as { chargeId: string }).chargeId);
      if (!pendingPaymentByChargeId.has(chargeId)) {
        pendingPaymentByChargeId.set(chargeId, {
          status: payment.status as "pending" | "processing",
          paymentMethod: payment.paymentMethod,
          createdAt: payment.createdAt ?? null,
        });
      }
    }
  }

  const unit = tenant.propertyUnit as {
    _id: string;
    name?: string;
    property?: {
      _id: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    } | null;
  } | null;
  const property = unit?.property ?? null;

  return {
    tenant: {
      _id: String(tenant._id),
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      email: tenant.email,
    },
    propertyUnit: unit
      ? {
          _id: String(unit._id),
          name: unit.name,
          property: property
            ? {
                _id: String(property._id),
                addressLine1: property.addressLine1,
                addressLine2: property.addressLine2,
                city: property.city,
                state: property.state,
                zipCode: property.zipCode,
              }
            : null,
        }
      : null,
    charges: charges.map((charge) => ({
      _id: String(charge._id),
      title: charge.title,
      category: charge.category
        ? {
            _id: String((charge.category as { _id: string })._id),
            name: (charge.category as { name: string }).name,
          }
        : null,
      amount: charge.amount,
      balance: charge.balance,
      dueDate: charge.dueDate,
      status: charge.status,
      paidAt: charge.paidAt ?? null,
      createdAt: charge.createdAt,
      pendingPayment: pendingPaymentByChargeId.get(String(charge._id)) ?? null,
    })),
  };
}
