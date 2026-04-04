/**
 * Unified ChargePayment status constants for the tenant portal.
 */

/** All statuses that mean "tenant's money has been collected." */
export const PAID_STATUSES = [
  "captured_by_platform",
  "held_on_connected_account",
  "available_on_connected_account",
  "payout_in_transit",
  "deposited_to_bank",
] as const;

export function isPaid(status: string): boolean {
  return (PAID_STATUSES as readonly string[]).includes(status);
}

/** Tenant display config — simplified, tenant doesn't care about fund routing. */
export const TENANT_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }
> = {
  payment_submitted:             { label: "Submitted",   variant: "warning" },
  ach_debit_in_transit:          { label: "Processing",  variant: "info" },
  captured_by_platform:          { label: "Paid",        variant: "success" },
  held_on_connected_account:     { label: "Paid",        variant: "success" },
  available_on_connected_account:{ label: "Paid",        variant: "success" },
  payout_in_transit:             { label: "Paid",        variant: "success" },
  deposited_to_bank:             { label: "Paid",        variant: "success" },
  failed:                        { label: "Failed",      variant: "danger" },
  canceled:                      { label: "Canceled",    variant: "default" },
  refunded:                      { label: "Refunded",    variant: "info" },
  disputed:                      { label: "Disputed",    variant: "danger" },
  payout_failed:                 { label: "Paid",        variant: "success" },
};
