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

export function calculateConvenienceFee(
  subtotal: number,
  method: "card" | "ach"
): number {
  if (method === "card") {
    const percentFee = subtotal * (stripeFeeSchedule.cardPercent / 100);
    const fixedFee = stripeFeeSchedule.cardFixedCents / 100;
    return Math.round((percentFee + fixedFee) * 100) / 100;
  }

  const percentFee = subtotal * (stripeFeeSchedule.achPercent / 100);
  const cappedFee = Math.min(percentFee, stripeFeeSchedule.achCapCents / 100);
  return Math.round(cappedFee * 100) / 100;
}

export default stripe;
