/**
 * The order state machine. Every status change goes through `transition()`, so an order can
 * never skip a step (for example from PENDING_PAYMENT straight to COMPLETED).
 *
 *  PENDING_PAYMENT --paid--> PAID_HELD --shipped--> SHIPPED --delivered--> DELIVERED --released--> COMPLETED
 *        |                      |                      |                       |
 *     cancelled              refunded              disputed                 disputed
 *        v                      v                      v                       v
 *    CANCELLED               REFUNDED              DISPUTED --(resolved)--> COMPLETED or REFUNDED
 *
 *  PAID_HELD can also be disputed (item never sent).
 */

export type OrderStatus =
  "PENDING_PAYMENT" | "PAID_HELD" | "SHIPPED" | "DELIVERED" | "COMPLETED" | "DISPUTED" | "REFUNDED" | "CANCELLED";

export type OrderEventType =
  | "payment_succeeded"
  | "payment_expired"
  | "buyer_cancelled"
  | "seller_cancelled"
  | "shipped"
  | "delivery_confirmed"
  | "auto_released"
  | "funds_released"
  | "dispute_opened"
  | "dispute_resolved_for_seller"
  | "dispute_resolved_for_buyer"
  | "staff_refunded";

const transitions: Record<OrderEventType, Partial<Record<OrderStatus, OrderStatus>>> = {
  payment_succeeded: { PENDING_PAYMENT: "PAID_HELD" },
  payment_expired: { PENDING_PAYMENT: "CANCELLED" },
  buyer_cancelled: { PENDING_PAYMENT: "CANCELLED" },
  // After payment the seller can still cancel before shipping; the buyer is refunded in full.
  seller_cancelled: { PENDING_PAYMENT: "CANCELLED", PAID_HELD: "REFUNDED" },
  shipped: { PAID_HELD: "SHIPPED" },
  delivery_confirmed: { SHIPPED: "DELIVERED" },
  // No confirmation and no dispute by the deadline: treated as delivered.
  auto_released: { SHIPPED: "DELIVERED" },
  funds_released: { DELIVERED: "COMPLETED" },
  // PAID_HELD too: "the seller never sent it" is the most common problem.
  dispute_opened: { PAID_HELD: "DISPUTED", SHIPPED: "DISPUTED", DELIVERED: "DISPUTED" },
  dispute_resolved_for_seller: { DISPUTED: "DELIVERED" },
  dispute_resolved_for_buyer: { DISPUTED: "REFUNDED" },
  // Staff cancel a paid order that hasn't been sent, e.g. after a fraud review.
  staff_refunded: { PAID_HELD: "REFUNDED" },
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly event: OrderEventType,
  ) {
    super(`An order that is ${from.toLowerCase().replace(/_/g, " ")} can't be ${event.replace(/_/g, " ")}.`);
    this.name = "InvalidTransitionError";
  }
}

export function nextStatus(from: OrderStatus, event: OrderEventType): OrderStatus | null {
  return transitions[event][from] ?? null;
}

export function transition(from: OrderStatus, event: OrderEventType): OrderStatus {
  const to = nextStatus(from, event);
  if (!to) throw new InvalidTransitionError(from, event);
  return to;
}

/** Statuses in which the payment provider holds the buyer's money and the seller hasn't been paid. */
export const FUNDS_HELD: readonly OrderStatus[] = ["PAID_HELD", "SHIPPED", "DELIVERED", "DISPUTED"];

/** Statuses that keep stock reserved. Cancelled and refunded orders give stock back. */
export const RESERVES_STOCK: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID_HELD",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "DISPUTED",
];

export const statusLabels: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Waiting for payment",
  PAID_HELD: "Paid, money held safely",
  SHIPPED: "On the way",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  DISPUTED: "In dispute",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

/** The happy path, for the tracking timeline. */
export const progressSteps: readonly OrderStatus[] = ["PAID_HELD", "SHIPPED", "DELIVERED", "COMPLETED"];
