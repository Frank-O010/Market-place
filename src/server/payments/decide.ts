/**
 * Pure decisions for payment webhooks, kept separate so every edge case can be unit tested:
 * duplicates, out-of-order events, late payments and amount mismatches.
 */

type PaymentRow = {
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  amountMinor: number;
};
type OrderRow = { status: string };

export type ChargeDecision =
  | { action: "ignore"; reason: "unknown_reference" | "duplicate" | "already_refunded" }
  | { action: "flag_amount_mismatch" }
  | { action: "mark_paid" }
  | { action: "refund_late_payment" };

export function decideChargeSuccess(
  payment: PaymentRow | null,
  order: OrderRow | null,
  event: { amount: number; currency: string },
): ChargeDecision {
  if (!payment || !order) return { action: "ignore", reason: "unknown_reference" };
  if (payment.status === "SUCCEEDED") return { action: "ignore", reason: "duplicate" };
  if (payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") {
    return { action: "ignore", reason: "already_refunded" };
  }
  if (event.amount !== payment.amountMinor || event.currency !== "KES") return { action: "flag_amount_mismatch" };
  // The buyer paid after the order expired or was cancelled (or a second attempt also went
  // through): don't take the money, give it straight back.
  if (order.status !== "PENDING_PAYMENT") return { action: "refund_late_payment" };
  return { action: "mark_paid" };
}

export type ChargeFailedDecision = { action: "ignore" } | { action: "mark_failed" };

/** A failure that arrives after a success (out of order) must never undo the success. */
export function decideChargeFailed(payment: PaymentRow | null): ChargeFailedDecision {
  return payment?.status === "PENDING" ? { action: "mark_failed" } : { action: "ignore" };
}

type PayoutRow = { status: "PENDING" | "PROCESSING" | "PAID" | "FAILED" };

export function decideTransfer(
  payout: PayoutRow | null,
  outcome: "success" | "failed",
): "ignore" | "mark_paid" | "mark_failed" {
  if (!payout) return "ignore";
  if (payout.status === "PAID") return "ignore"; // duplicate success, or a late failure after success
  if (outcome === "success") return "mark_paid";
  return payout.status === "FAILED" ? "ignore" : "mark_failed";
}
