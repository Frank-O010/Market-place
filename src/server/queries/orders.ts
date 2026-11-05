import "server-only";
import type { CurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";

export const orderDetailSelect = {
  id: true,
  number: true,
  status: true,
  buyerId: true,
  sellerId: true,
  subtotalMinor: true,
  deliveryFeeMinor: true,
  platformFeeMinor: true,
  totalMinor: true,
  deliveryMethod: true,
  deliveryAddress: true,
  buyerPhone: true,
  paymentDueAt: true,
  shippedAt: true,
  trackingNote: true,
  deliveredAt: true,
  completedAt: true,
  cancelledAt: true,
  cancelReason: true,
  autoReleaseAt: true,
  createdAt: true,
  buyer: { select: { name: true, email: true } },
  seller: { select: { displayName: true, slug: true, location: true } },
  items: {
    select: {
      id: true,
      titleSnapshot: true,
      quantity: true,
      unitPriceMinor: true,
      listing: { select: { id: true, slug: true } },
    },
  },
  events: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, note: true, createdAt: true } },
  payments: {
    orderBy: { createdAt: "desc" },
    select: { providerReference: true, method: true, status: true, amountMinor: true, createdAt: true },
  },
  payout: { select: { id: true, status: true, amountMinor: true, paidAt: true, failureReason: true } },
  fraudFlags: true,
  fraudReviewedAt: true,
  refundedMinor: true,
  review: { select: { id: true, rating: true, body: true, sellerReply: true, createdAt: true } },
  dispute: {
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      evidenceKeys: true,
      sellerResponse: true,
      resolution: true,
      resolutionNote: true,
      refundAmountMinor: true,
      createdAt: true,
      resolvedAt: true,
    },
  },
} as const;

/** Loads an order if the user may see it (buyer, the seller, or staff); otherwise null. */
export async function loadOrderForViewer(user: CurrentUser, orderId: string) {
  if (!/^[a-z0-9]{20,40}$/i.test(orderId)) return null;
  const order = await db.order.findUnique({ where: { id: orderId }, select: orderDetailSelect });
  if (!order || !can(user, "view", "order", order)) return null;
  // A seller gets the buyer's contact details only once the order is paid, so an unpaid
  // order can't be used to harvest phone numbers and addresses.
  const isBuyer = order.buyerId === user.id;
  const unpaid =
    order.status === "PENDING_PAYMENT" ||
    (order.status === "CANCELLED" && !order.payments.some((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED"));
  if (!isBuyer && unpaid) return { ...order, buyerPhone: null, deliveryAddress: null };
  return order;
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof loadOrderForViewer>>>;
