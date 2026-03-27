"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

interface PortalCharge {
  _id: string;
  title: string;
  category: { _id: string; name: string } | null;
  amount: number;
  balance: number;
  dueDate: string;
  status: "unpaid" | "partial" | "paid" | "overdue" | "voided" | "waived";
  paidAt: string | null;
  createdAt: string;
  parentCharge: string | null;
  pendingPayment: {
    status: "pending" | "processing";
    paymentMethod: string;
    createdAt: string | null;
  } | null;
}

interface PortalSession {
  tenant: { _id: string; firstName?: string; lastName?: string; email?: string };
  propertyUnit: {
    _id: string;
    name: string;
    property: {
      addressLine1?: string;
      city?: string;
      state?: string;
    } | null;
  } | null;
  charges: PortalCharge[];
}

interface PaymentContext {
  chargeId: string;
  chargeName: string;
  paymentIntentId: string;
  clientSecret: string;
  stripePromise: Promise<Stripe | null>;
  amountCents: number;
  convenienceFeeCents: number;
  convenienceFeePaidBy: "tenant" | "landlord";
  paymentMethod: "card" | "ach";
}

type PaymentMethod = "card" | "ach";

const PAYABLE: PortalCharge["status"][] = ["unpaid", "partial", "overdue"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function fmtCents(cents: number) {
  return fmt(cents / 100);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_STYLE: Record<
  PortalCharge["status"],
  { label: string; color: string; bg: string; border: string }
> = {
  overdue: { label: "Overdue", color: "#991b1b", bg: "#fef2f2", border: "#fca5a5" },
  unpaid: { label: "Unpaid", color: "#92400e", bg: "#fffbeb", border: "#fcd34d" },
  partial: { label: "Partial", color: "#1e40af", bg: "#eff6ff", border: "#93c5fd" },
  paid: { label: "Paid", color: "#166534", bg: "#f0fdf4", border: "#86efac" },
  waived: { label: "Waived", color: "#6b21a8", bg: "#faf5ff", border: "#d8b4fe" },
  voided: { label: "Voided", color: "#475569", bg: "#f8fafc", border: "#cbd5e1" },
};

function Header() {
  return (
    <header
      style={{
        background: "#0f172a",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
          Chimi Rental
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>Tenant Portal</p>
      </div>
      <a
        href="/api/auth/logout"
        style={{
          color: "#e2e8f0",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Log out
      </a>
    </header>
  );
}

function StatusBadge({ status }: { status: PortalCharge["status"] }) {
  const item = STATUS_STYLE[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        color: item.color,
        background: item.bg,
        border: `1px solid ${item.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {item.label}
    </span>
  );
}

function PaymentForm({
  ctx,
  tenant,
  onSuccess,
  onClose,
}: {
  ctx: PaymentContext;
  tenant: { firstName?: string; lastName?: string; email?: string };
  onSuccess: (chargeId: string, status: "succeeded" | "processing") => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!stripe || !elements) return;

    setConfirming(true);
    setError(null);

    const returnUrl = `${window.location.origin}/?payment_status=succeeded&charge_id=${ctx.chargeId}`;

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message ?? "Payment failed. Please try again.");
      setConfirming(false);
      return;
    }

    if (result.paymentIntent?.status === "succeeded") {
      onSuccess(ctx.chargeId, "succeeded" as const);
      return;
    }

    if (result.paymentIntent?.status === "processing") {
      onSuccess(ctx.chargeId, "processing" as const);
      return;
    }

    setConfirming(false);
  }

  return (
    <div>
      <PaymentElement
        options={{
          layout: "tabs",
          paymentMethodOrder: ["card", "us_bank_account"],
          defaultValues: {
            billingDetails: {
              name: [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") || undefined,
              email: tenant.email || undefined,
            },
          },
        }}
      />
      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          disabled={confirming}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "#fff",
            color: "#475569",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!stripe || !elements || confirming}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: !stripe || confirming ? "#94a3b8" : "#2563eb",
            color: "#fff",
            minWidth: 130,
          }}
        >
          {confirming ? "Processing..." : `Pay ${fmtCents(ctx.amountCents)}`}
        </button>
      </div>
    </div>
  );
}

function PaymentModal({
  charges,
  tenant,
  onSuccess,
  onClose,
}: {
  charges: PortalCharge[];
  tenant: { firstName?: string; lastName?: string; email?: string };
  onSuccess: (chargeIds: string[], status: "succeeded" | "processing") => void;
  onClose: () => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("ach");
  const [ctx, setCtx] = useState<PaymentContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const totalBalance = charges.reduce((sum, c) => sum + c.balance, 0);
  const chargeIds = charges.map((c) => c._id);

  async function cleanupPendingCheckout(pendingCtx: PaymentContext) {
    try {
      await fetch("/api/tenant-portal/pay/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: pendingCtx.paymentIntentId }),
      });
    } catch {
      // best-effort
    }
  }

  async function handleCloseModal() {
    if (closing) return;
    setClosing(true);
    if (ctx) await cleanupPendingCheckout(ctx);
    setCtx(null);
    setLoadError(null);
    setClosing(false);
    onClose();
  }

  async function handleChangeMethod() {
    if (closing) return;
    setClosing(true);
    if (ctx) await cleanupPendingCheckout(ctx);
    setCtx(null);
    setLoadError(null);
    setClosing(false);
  }

  async function startCheckout() {
    setLoading(true);
    setLoadError(null);

    try {
      const res = await fetch("/api/tenant-portal/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chargeIds,
          paymentMethod: selectedMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to initiate payment");
      }
      setCtx({
        chargeId: chargeIds[0],
        chargeName: data.chargeName,
        paymentIntentId: data.paymentIntentId,
        clientSecret: data.clientSecret,
        stripePromise: loadStripe(data.publishableKey),
        amountCents: data.amountCents,
        convenienceFeeCents: data.convenienceFeeCents,
        convenienceFeePaidBy: data.convenienceFeePaidBy,
        paymentMethod: selectedMethod,
      });
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to initiate payment"
      );
    } finally {
      setLoading(false);
    }
  }

  const subtotalCents = ctx
    ? ctx.amountCents - ctx.convenienceFeeCents
    : Math.round(totalBalance * 100);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) void handleCloseModal();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 20px 60px rgba(15,23,42,0.2)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>
            Pay {ctx ? fmtCents(ctx.amountCents) : fmt(totalBalance)}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            {ctx?.chargeName ?? (charges.length === 1 ? charges[0].title : `${charges.length} charges`)}
          </p>
          {!ctx && charges.length > 1 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {charges.map((c) => (
                <div key={c._id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                  <span>{c.title}</span>
                  <span>{fmt(c.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: 24 }}>
          {!ctx ? (
            <div>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569" }}>
                Choose how you want to pay.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {(["ach", "card"] as const).map((option) => {
                  const active = selectedMethod === option;
                  const isAch = option === "ach";
                  return (
                    <button
                      key={option}
                      onClick={() => setSelectedMethod(option)}
                      style={{
                        borderRadius: 10,
                        border: `${isAch && active ? "2px" : "1px"} solid ${active ? "#2563eb" : "#cbd5e1"}`,
                        background: active ? "#eff6ff" : "#fff",
                        padding: "14px 16px",
                        textAlign: "left",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      {isAch && (
                        <span
                          style={{
                            position: "absolute",
                            top: -9,
                            left: 12,
                            background: "#16a34a",
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 8px",
                            borderRadius: 4,
                            letterSpacing: "0.02em",
                            textTransform: "uppercase",
                          }}
                        >
                          Recommended
                        </span>
                      )}
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                        {isAch ? "ACH" : "Card"}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        {isAch ? "US bank account" : "Debit or credit card"}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 6, color: isAch ? "#16a34a" : "#94a3b8", fontWeight: isAch ? 600 : 400 }}>
                        {isAch ? "Lower fees" : "Higher fees"}
                      </div>
                    </button>
                  );
                })}
              </div>
              {loadError ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    fontSize: 13,
                  }}
                >
                  {loadError}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
                <button
                  onClick={() => void handleCloseModal()}
                  disabled={loading || closing}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#475569",
                    cursor: loading || closing ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={startCheckout}
                  disabled={loading || closing}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: loading || closing ? "#94a3b8" : "#2563eb",
                    color: "#fff",
                    cursor: loading || closing ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Loading..." : `Continue with ${selectedMethod === "ach" ? "ACH" : "card"}`}
                </button>
              </div>
            </div>
          ) : (
            <>
              {ctx.convenienceFeePaidBy === "tenant" && ctx.convenienceFeeCents > 0 ? (
                <div style={{ padding: "12px 0 16px", borderBottom: "1px solid #f1f5f9", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 4 }}>
                    <span>Charge amount</span>
                    <span>{fmtCents(subtotalCents)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 6 }}>
                    <span>{ctx.paymentMethod === "ach" ? "ACH processing fee" : "Card processing fee"}</span>
                    <span>{fmtCents(ctx.convenienceFeeCents)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
                    <span>Total</span>
                    <span>{fmtCents(ctx.amountCents)}</span>
                  </div>
                </div>
              ) : null}
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Paying by {ctx.paymentMethod === "ach" ? "ACH" : "card"}
                </div>
                <button
                  onClick={() => void handleChangeMethod()}
                  disabled={closing}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    cursor: closing ? "not-allowed" : "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: 0,
                  }}
                >
                  Change method
                </button>
              </div>
              <Elements
                stripe={ctx.stripePromise}
                options={{
                  clientSecret: ctx.clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: { colorPrimary: "#2563eb", borderRadius: "8px" },
                  },
                }}
              >
                <PaymentForm
                  ctx={ctx}
                  tenant={tenant}
                  onSuccess={(_chargeId, status) => onSuccess(chargeIds, status)}
                  onClose={() => void handleCloseModal()}
                />
              </Elements>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TenantPortalDashboard({
  fetchUrl,
  paymentStatus,
  paymentChargeId,
}: {
  fetchUrl: string;
  paymentStatus?: string | null;
  paymentChargeId?: string | null;
}) {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutCharges, setCheckoutCharges] = useState<PortalCharge[] | null>(null);
  const [successChargeIds, setSuccessChargeIds] = useState<string[]>([]);
  const [processingChargeIds, setProcessingChargeIds] = useState<string[]>([]);
  // Brief cooldown after modal closes to prevent accidental double-clicks
  const [cooldownChargeIds, setCooldownChargeIds] = useState<string[]>([]);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(fetchUrl, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load portal");
      }
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portal");
    } finally {
      setLoading(false);
    }
  }, [fetchUrl]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!paymentStatus || !paymentChargeId) return;

    const timer = window.setTimeout(() => {
      if (paymentStatus === "succeeded") {
        setSuccessChargeIds([paymentChargeId]);
        setProcessingChargeIds([]);
        window.history.replaceState({}, "", "/");
        return;
      }
      if (paymentStatus === "processing") {
        setProcessingChargeIds([paymentChargeId]);
        setSuccessChargeIds([]);
        window.history.replaceState({}, "", "/");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [paymentChargeId, paymentStatus]);

  function handlePaymentSuccess(
    chargeIds: string[],
    status: "succeeded" | "processing"
  ) {
    setCheckoutCharges(null);
    if (status === "succeeded") {
      setSuccessChargeIds(chargeIds);
      setProcessingChargeIds([]);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              charges: prev.charges.map((charge) =>
                chargeIds.includes(charge._id)
                  ? {
                      ...charge,
                      status: "paid" as const,
                      balance: 0,
                      paidAt: new Date().toISOString(),
                    }
                  : charge
              ),
            }
          : prev
      );
    } else {
      setProcessingChargeIds(chargeIds);
      setSuccessChargeIds([]);
    }

    window.setTimeout(() => {
      void loadSession();
    }, 3000);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <Header />
        <div style={{ minHeight: "calc(100vh - 68px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#64748b", fontSize: 14 }}>Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    const isNotLinked =
      error === "Tenant portal access not linked" ||
      error === "No tenant record matched the signed-in email.";
    const isConflict = error?.includes("Multiple tenant records");

    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <Header />
        <div style={{ minHeight: "calc(100vh - 68px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{ maxWidth: 440, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>
              {isNotLinked || isConflict ? "🔒" : "⚠️"}
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
              {isNotLinked
                ? "Account not linked"
                : isConflict
                ? "Account conflict"
                : "Portal unavailable"}
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
              {isNotLinked
                ? "Your sign-in email doesn't match any tenant record. Please make sure you're using the email your landlord has on file, or contact your landlord to update your invitation."
                : isConflict
                ? "Multiple tenant records match your email. Please contact your landlord or support to resolve this."
                : (error ?? "We couldn't load your tenant portal right now. Please try again.")}
            </p>
            {(isNotLinked || isConflict) && (
              <a
                href="/api/auth/logout"
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#475569",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Sign out and try a different account
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { tenant, propertyUnit, charges } = session;
  const tenantName =
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") || "Tenant";
  const property = propertyUnit?.property;
  const propertyLabel = property?.addressLine1
    ? `${property.addressLine1}${property.city ? `, ${property.city}` : ""}${property.state ? ` ${property.state}` : ""}`
    : propertyUnit?.name ?? "-";

  const totalBalance = charges
    .filter((charge) => PAYABLE.includes(charge.status))
    .reduce((sum, charge) => sum + charge.balance, 0);
  const currentChargesFlat = charges.filter((charge) => PAYABLE.includes(charge.status));
  const pastChargesFlat = charges.filter((charge) => !PAYABLE.includes(charge.status));

  // Group late fees (children) under their parent charge
  const groupCharges = (list: PortalCharge[]): PortalCharge[] => {
    const parents = list.filter((c) => !c.parentCharge);
    const childrenByParent = new Map<string, PortalCharge[]>();
    for (const c of list) {
      if (c.parentCharge) {
        const arr = childrenByParent.get(c.parentCharge) || [];
        arr.push(c);
        childrenByParent.set(c.parentCharge, arr);
      }
    }
    const result: PortalCharge[] = [];
    for (const p of parents) {
      result.push(p);
      const children = childrenByParent.get(p._id);
      if (children) {
        children.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        result.push(...children);
      }
    }
    // Orphan late fees (parent not in this list)
    for (const c of list) {
      if (c.parentCharge && !parents.some((p) => p._id === c.parentCharge)) {
        result.push(c);
      }
    }
    return result;
  };

  const currentCharges = groupCharges(currentChargesFlat);
  const pastCharges = groupCharges(pastChargesFlat);
  const chargeSections: ReadonlyArray<readonly [string, PortalCharge[]]> = [
    ["Current charges", currentCharges],
    ["Past charges", pastCharges],
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Header />
      <main style={{ maxWidth: 720, width: "100%", margin: "0 auto", padding: "24px 16px 48px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>
            Welcome, {tenantName}
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>{propertyLabel}</p>
        </div>

        {(successChargeIds.length > 0 || processingChargeIds.length > 0) && (
          <div
            style={{
              marginBottom: 20,
              padding: "14px 18px",
              borderRadius: 10,
              background: successChargeIds.length > 0 ? "#f0fdf4" : "#eff6ff",
              border: successChargeIds.length > 0 ? "1px solid #86efac" : "1px solid #93c5fd",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: successChargeIds.length > 0 ? "#166534" : "#1d4ed8",
              }}
            >
              {successChargeIds.length > 0 ? "Payment successful" : "Payment is processing"}
            </p>
            {processingChargeIds.length > 0 && (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 13,
                  color: "#1e40af",
                  lineHeight: 1.5,
                }}
              >
                ACH payments take 3–5 business days to process. Please ensure sufficient funds
                remain in your bank account for the next 5 business days. If the transfer is
                returned due to insufficient funds, the payment will be reversed and may result
                in late fees.
              </p>
            )}
          </div>
        )}

        {/* Pay All banner */}
        {currentCharges.length > 1 && totalBalance > 0 && (
          <>
            <div
              style={{
                marginBottom: 8,
                padding: "20px 24px",
                borderRadius: 14,
                background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#bfdbfe" }}>
                  {currentCharges.length} charges due
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, color: "#fff" }}>
                  {fmt(totalBalance)}
                </p>
              </div>
              {(() => {
                const allHandled = currentCharges.every(c =>
                  !!c.pendingPayment || successChargeIds.includes(c._id) || processingChargeIds.includes(c._id) || cooldownChargeIds.includes(c._id)
                );
                const btnDisabled = !!checkoutCharges || allHandled;
                return (
                  <button
                    onClick={() => {
                      const payable = currentCharges.filter(c => !c.pendingPayment && !successChargeIds.includes(c._id) && !processingChargeIds.includes(c._id));
                      if (payable.length > 0) setCheckoutCharges(payable);
                    }}
                    disabled={btnDisabled}
                    style={{
                      padding: "14px 32px",
                      borderRadius: 10,
                      border: "none",
                      background: btnDisabled ? "#94a3b8" : "#fff",
                      color: btnDisabled ? "#fff" : "#1e40af",
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: btnDisabled ? "not-allowed" : "pointer",
                      boxShadow: btnDisabled ? "none" : "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                  >
                    {allHandled ? "Payment submitted" : `Pay All ${fmt(totalBalance)}`}
                  </button>
                );
              })()}
            </div>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <button
                onClick={() => {
                  setPickerSelected(new Set());
                  setShowPickerModal(true);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: 12,
                  cursor: "pointer",
                  padding: "4px 8px",
                  textDecoration: "underline",
                }}
              >
                or pay separately
              </button>
            </div>
          </>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div style={{ padding: "14px 16px", borderRadius: 10, background: totalBalance > 0 ? "#fef2f2" : "#f0fdf4", border: `1px solid ${totalBalance > 0 ? "#fecaca" : "#bbf7d0"}` }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: totalBalance > 0 ? "#991b1b" : "#166534" }}>
              Balance Due
            </p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: totalBalance > 0 ? "#dc2626" : "#16a34a" }}>
              {fmt(totalBalance)}
            </p>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Open Charges
            </p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{currentCharges.length}</p>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              History
            </p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{pastCharges.length}</p>
          </div>
        </div>

        {chargeSections.map(([title, list]) => (
          <section
            key={title}
            style={{
              marginBottom: 20,
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", background: "#fcfdff" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
            </div>
            {list.length ? (
              list.map((charge) => {
                const payable = PAYABLE.includes(charge.status);
                const inFlight = !!charge.pendingPayment;
                const justPaid = successChargeIds.includes(charge._id) || processingChargeIds.includes(charge._id);
                const coolingDown = cooldownChargeIds.includes(charge._id);
                const isChild = !!charge.parentCharge;
                return (
                  <div
                    key={charge._id}
                    style={{
                      padding: isChild ? "12px 20px 12px 36px" : "16px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      flexWrap: "wrap",
                      borderTop: "1px solid #f8fafc",
                      ...(isChild ? { borderLeft: "3px solid #fde68a", background: "#fffdf7" } : {}),
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <p style={{ margin: "0 0 2px", fontSize: isChild ? 13 : 14, fontWeight: 600, color: isChild ? "#64748b" : undefined }}>
                        {isChild && <span style={{ color: "#f59e0b", marginRight: 4 }}>↳</span>}
                        {charge.title}
                        {isChild && (
                          <span
                            style={{
                              display: "inline-block",
                              marginLeft: 6,
                              fontSize: 10,
                              fontWeight: 500,
                              color: "#f59e0b",
                              background: "#fffbeb",
                              border: "1px solid #fde68a",
                              borderRadius: 4,
                              padding: "1px 5px",
                              verticalAlign: "middle",
                            }}
                          >
                            Late Fee
                          </span>
                        )}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                        {charge.category?.name ?? "-"} · Due {fmtDate(charge.dueDate)}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 100 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700 }}>
                        {fmt(charge.amount)}
                      </p>
                      {charge.balance !== charge.amount ? (
                        <p style={{ margin: 0, fontSize: 12, color: payable ? "#dc2626" : "#16a34a" }}>
                          {payable ? `${fmt(charge.balance)} remaining` : "Settled"}
                        </p>
                      ) : null}
                    </div>
                    <div style={{ minWidth: 70, textAlign: "center" }}>
                      <StatusBadge status={charge.status} />
                    </div>
                    <div style={{ minWidth: 130 }}>
                      {payable ? (
                        currentCharges.length === 1 ? (
                        <button
                          onClick={() => setCheckoutCharges([charge])}
                          disabled={!!checkoutCharges || inFlight || justPaid || coolingDown}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            border: "none",
                            background: !!checkoutCharges || inFlight || justPaid || coolingDown ? "#94a3b8" : "#2563eb",
                            color: "#fff",
                            width: "100%",
                            fontWeight: 600,
                            cursor: !!checkoutCharges || inFlight || justPaid || coolingDown ? "not-allowed" : "pointer",
                          }}
                        >
                          {inFlight || justPaid ? "Payment pending" : `Pay ${fmt(charge.balance)}`}
                        </button>
                        ) : (
                          <span style={{ fontSize: 12, color: inFlight || justPaid ? "#2563eb" : "#94a3b8", fontWeight: inFlight || justPaid ? 600 : 400 }}>
                            {inFlight || justPaid ? "Payment pending" : ""}
                          </span>
                        )
                      ) : (
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          {charge.paidAt ? `Paid ${fmtDate(charge.paidAt)}` : "-"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: 20, fontSize: 14, color: "#64748b" }}>
                No charges in this section.
              </div>
            )}
          </section>
        ))}
      </main>
      {showPickerModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPickerModal(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 20px 60px rgba(15,23,42,0.2)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>
                Select charges to pay
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "#ef4444", lineHeight: 1.5 }}>
                A processing fee applies to each separate payment. Paying all charges together saves on fees.
              </p>
            </div>
            <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
              {currentCharges
                .filter((c) => !c.pendingPayment && !successChargeIds.includes(c._id) && !processingChargeIds.includes(c._id))
                .map((charge) => {
                  const isChild = !!charge.parentCharge;
                  // Late fees are auto-selected when parent is selected and can't be deselected
                  const parentSelected = isChild && pickerSelected.has(charge.parentCharge!);
                  const selected = pickerSelected.has(charge._id) || parentSelected;
                  const locked = isChild; // late fees cannot be independently toggled
                  return (
                    <label
                      key={charge._id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: isChild ? "10px 14px 10px 28px" : "12px 14px",
                        borderRadius: 10,
                        border: `1px solid ${selected ? (isChild ? "#fde68a" : "#2563eb") : "#e2e8f0"}`,
                        background: selected ? (isChild ? "#fffdf7" : "#eff6ff") : "#fff",
                        cursor: locked ? "default" : "pointer",
                        opacity: locked && !selected ? 0.5 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={locked}
                        onChange={() => {
                          if (locked) return;
                          setPickerSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(charge._id)) {
                              next.delete(charge._id);
                              // Also remove child late fees when deselecting parent
                              for (const c of currentCharges) {
                                if (c.parentCharge === charge._id) next.delete(c._id);
                              }
                            } else {
                              next.add(charge._id);
                              // Auto-select child late fees when selecting parent
                              for (const c of currentCharges) {
                                if (c.parentCharge === charge._id) next.add(c._id);
                              }
                            }
                            return next;
                          });
                        }}
                        style={{ width: 16, height: 16, accentColor: isChild ? "#f59e0b" : "#2563eb" }}
                      />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: isChild ? 13 : 14, fontWeight: 600, color: isChild ? "#64748b" : undefined }}>
                          {isChild && <span style={{ color: "#f59e0b", marginRight: 4 }}>↳</span>}
                          {charge.title}
                          {isChild && (
                            <span
                              style={{
                                display: "inline-block",
                                marginLeft: 6,
                                fontSize: 10,
                                fontWeight: 500,
                                color: "#f59e0b",
                                background: "#fffbeb",
                                border: "1px solid #fde68a",
                                borderRadius: 4,
                                padding: "1px 5px",
                                verticalAlign: "middle",
                              }}
                            >
                              Late Fee
                            </span>
                          )}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                          {charge.category?.name ?? "-"} · Due {fmtDate(charge.dueDate)}
                        </p>
                      </div>
                      <span style={{ fontSize: isChild ? 13 : 14, fontWeight: 700 }}>{fmt(charge.balance)}</span>
                    </label>
                  );
                })}
            </div>
            <div style={{ padding: "16px 24px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>
                {(() => {
                  // Include auto-selected late fees in the count
                  const effectiveSelected = currentCharges.filter((c) =>
                    pickerSelected.has(c._id) || (c.parentCharge && pickerSelected.has(c.parentCharge))
                  );
                  return effectiveSelected.length > 0
                    ? `${effectiveSelected.length} selected · ${fmt(effectiveSelected.reduce((s, c) => s + c.balance, 0))}`
                    : "Select at least one charge";
                })()}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowPickerModal(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Include auto-selected late fees
                    const selected = currentCharges.filter((c) =>
                      pickerSelected.has(c._id) || (c.parentCharge && pickerSelected.has(c.parentCharge))
                    );
                    if (selected.length > 0) {
                      setShowPickerModal(false);
                      setCheckoutCharges(selected);
                    }
                  }}
                  disabled={pickerSelected.size === 0}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: pickerSelected.size === 0 ? "#94a3b8" : "#2563eb",
                    color: "#fff",
                    cursor: pickerSelected.size === 0 ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  Continue to pay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {checkoutCharges ? (
        <PaymentModal
          charges={checkoutCharges}
          tenant={session?.tenant ?? {}}
          onSuccess={handlePaymentSuccess}
          onClose={() => {
            const closedIds = checkoutCharges.map((c) => c._id);
            setCheckoutCharges(null);
            setCooldownChargeIds(closedIds);
            window.setTimeout(() => setCooldownChargeIds([]), 2000);
          }}
        />
      ) : null}
    </div>
  );
}
