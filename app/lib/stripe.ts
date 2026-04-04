import Stripe from "stripe";

if (!process.env.STRIPE_API_KEY) {
  throw new Error("Missing STRIPE_API_KEY environment variable");
}

const stripe = new Stripe(process.env.STRIPE_API_KEY, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export const stripeFeeSchedule = {
  cardPercent: getEnvNumber("STRIPE_CARD_FEE_PERCENT", 2.9),
  cardFixedCents: getEnvNumber("STRIPE_CARD_FEE_FIXED_CENTS", 30),
  achPercent: getEnvNumber("STRIPE_ACH_FEE_PERCENT", 0.8),
  achCapCents: getEnvNumber("STRIPE_ACH_FEE_CAP_CENTS", 500),
};

/**
 * Calculate the convenience fee to charge so that the fee collected exactly
 * covers Stripe's processing cost — no platform subsidy.
 *
 * feePaidBy="landlord": Stripe charges on subtotal (tenant pays face value).
 *   fee = subtotal × rate  (same base as Stripe, direct pass-through)
 *
 * feePaidBy="tenant": Stripe charges on (subtotal + fee), so we must gross up.
 *   fee = subtotal × rate / (1 - rate)
 *   Proof: Stripe takes (subtotal + fee) × rate = fee  ✓
 *
 * Card has an additional fixed component ($0.30), so:
 *   fee = (subtotal × rate + fixed) / (1 - rate)
 */
export function calculateConvenienceFee(
  subtotal: number,
  method: "card" | "ach",
  feePaidBy: "tenant" | "landlord" = "tenant"
): number {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  if (method === "card") {
    const rate = stripeFeeSchedule.cardPercent / 100;
    const fixed = stripeFeeSchedule.cardFixedCents / 100;
    if (feePaidBy === "landlord") {
      // Stripe charges on subtotal — direct pass-through
      return round2(subtotal * rate + fixed);
    }
    // Gross up so fee covers Stripe's charge on the total
    return round2((subtotal * rate + fixed) / (1 - rate));
  }

  // ACH
  const rate = stripeFeeSchedule.achPercent / 100;
  const cap = stripeFeeSchedule.achCapCents / 100; // $5.00

  if (feePaidBy === "landlord") {
    // Stripe charges on subtotal — direct pass-through, cap applies normally
    return round2(Math.min(subtotal * rate, cap));
  }

  // Gross up: fee = subtotal × rate / (1 - rate), capped at $5
  // At cap, Stripe charges exactly $5 regardless of total, so fee = $5
  const grossedUp = (subtotal * rate) / (1 - rate);
  return round2(Math.min(grossedUp, cap));
}

export default stripe;
