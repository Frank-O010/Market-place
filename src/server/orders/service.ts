import "server-only";
import * as Sentry from "@sentry/nextjs";
import { transition, type OrderEventType, type OrderStatus } from "@/lib/orders/state";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import * as templates from "@/server/email/templates";
import { getPaymentGateway } from "@/server/payments";
import { getSetting } from "@/server/settings";
import { syncListingToSearch } from "@/server/search";
import { notify } from "@/server/notifications";
import { formatKes } from "@/lib/money";
import { captureEvent } from "@/server/analytics";
import { checkOrderForFraud } from "./fraud";
import { createPayoutForOrder } from "./payouts";

/**
 * Every order status change goes through applyOrderEvent(): it checks the state machine,
 * updates the order with an optimistic lock (so two requests can't both move it), writes the
 * timeline, and then runs the side effects (stock, refunds, payouts, emails).
 */

export class OrderConflictError extends Error {
  constructor() {
    super("This order was just updated. Please refresh and try again.");
    this.name = "OrderConflictError";
  }
}

const AUTO_RELEASE_NOTE = "Released automatically after the confirmation window.";

const summarySelect = {
  id: true,
  number: true,
  status: true,
  buyerId: true,
  sellerId: true,
  subtotalMinor: true,
  deliveryFeeMinor: true,
  platformFeeMinor: true,
  totalMinor: true,
  trackingNote: true,
  items: { select: { listingId: true, variantId: true, titleSnapshot: true, quantity: true, unitPriceMinor: true } },
  buyer: { select: { email: true } },
  guestEmail: true,
  buyerPhone: true,
  seller: { select: { displayName: true, user: { select: { id: true, email: true, phone: true } } } },
  payments: { select: { id: true, providerReference: true, status: true, amountMinor: true } },
} as const;

export async function loadOrderSummary(orderId: string) {
  return db.order.findUniqueOrThrow({ where: { id: orderId }, select: summarySelect });
}

type ApplyInput = {
  orderId: string;
  event: OrderEventType;
  actorId: string | null;
  note?: string;
  /** Only for "shipped": the seller's tracking note. */
  trackingNote?: string;
};

export async function applyOrderEvent(input: ApplyInput): Promise<OrderStatus> {
  const now = new Date();
  const autoReleaseDays = await getSetting("auto_release_days");

  const { from, to, items } = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: input.orderId },
      select: { status: true, items: { select: { listingId: true, variantId: true, quantity: true } } },
    });
    const to = transition(order.status, input.event);
    const timestamps =
      to === "SHIPPED"
        ? {
            shippedAt: now,
            trackingNote: input.trackingNote ?? null,
            autoReleaseAt: new Date(now.getTime() + autoReleaseDays * 86_400_000),
          }
        : to === "DELIVERED"
          ? { deliveredAt: now }
          : to === "COMPLETED"
            ? { completedAt: now }
            : to === "CANCELLED" || to === "REFUNDED"
              ? { cancelledAt: now, cancelReason: input.note ?? null }
              : {};
    // Optimistic lock: only move the order if nobody else moved it first.
    const updated = await tx.order.updateMany({
      where: { id: input.orderId, status: order.status },
      data: { status: to, ...timestamps },
    });
    if (updated.count !== 1) throw new OrderConflictError();
    await tx.orderEvent.create({
      data: { orderId: input.orderId, status: to, actorId: input.actorId, note: input.note ?? null },
    });
    if (to === "CANCELLED" || (to === "REFUNDED" && order.status !== "DISPUTED")) {
      // Give the reserved stock back.
      for (const item of order.items) {
        if (item.variantId) {
          await tx.listingVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        } else {
          await tx.listing.update({ where: { id: item.listingId }, data: { stock: { increment: item.quantity } } });
        }
      }
    }
    return { from: order.status, to, items: order.items };
  });

  await audit({
    action: `order.${input.event}`,
    actorId: input.actorId,
    targetType: "order",
    targetId: input.orderId,
    metadata: { from, to },
  });

  try {
    await afterTransition(input, to, autoReleaseDays);
  } catch (error) {
    // The status change stands; side effects are retried by the daily maintenance job.
    console.error("[orders] side effect failed", input.orderId, to, error);
    Sentry.captureException(error, { tags: { area: "orders" }, extra: { orderId: input.orderId, to } });
  }
  if (to === "CANCELLED" || to === "REFUNDED") {
    for (const listingId of new Set(items.map((i) => i.listingId))) await syncListingToSearch(listingId);
  }
  return to;
}

async function afterTransition(input: ApplyInput, to: OrderStatus, autoReleaseDays: number) {
  const order = await loadOrderSummary(input.orderId);
  const buyerEmail = order.buyer?.email ?? order.guestEmail;
  await notifyParties(order, to, input);

  switch (to) {
    case "PAID_HELD":
      await checkOrderForFraud(order.id);
      await trackOrderPaid(order.id);
      await sendEmail({
        to: buyerEmail,
        template: "payment_receipt",
        orderId: order.id,
        ...templates.paymentReceipt(order, order.seller.displayName),
      });
      await sendEmail({
        to: order.seller.user.email,
        template: "new_order",
        orderId: order.id,
        ...templates.newOrderForSeller(order),
      });
      break;
    case "SHIPPED":
      await sendEmail({
        to: buyerEmail,
        template: "order_shipped",
        orderId: order.id,
        ...templates.orderShipped(order, order.trackingNote, autoReleaseDays),
      });
      break;
    case "DELIVERED":
      // Delivery confirmed (or the confirmation window passed): release the money to the seller.
      await applyOrderEvent({
        orderId: order.id,
        event: "funds_released",
        actorId: null,
        note:
          input.event === "auto_released"
            ? AUTO_RELEASE_NOTE
            : input.event === "dispute_resolved_for_seller"
              ? "Dispute resolved: payment released to the seller."
              : "The buyer confirmed delivery.",
      });
      break;
    case "COMPLETED":
      await createPayoutForOrder(order.id);
      await sendEmail({
        to: order.seller.user.email,
        template: "funds_released",
        orderId: order.id,
        ...templates.fundsReleased(order, input.note === AUTO_RELEASE_NOTE),
      });
      await markSoldOutListings(order.items.map((i) => i.listingId));
      break;
    case "REFUNDED":
      await refundOrderPayments(order.id);
      await sendEmail({
        to: buyerEmail,
        template: "order_refunded",
        orderId: order.id,
        ...templates.orderCancelled(order, true, input.note ?? "The seller cancelled your order."),
      });
      break;
    case "CANCELLED":
      await sendEmail({
        to: buyerEmail,
        template: "order_cancelled",
        orderId: order.id,
        ...templates.orderCancelled(order, false, input.note ?? "The order was cancelled."),
      });
      break;
  }
}

/** The last step of the analytics funnel, sent from the server (only for buyers who opted in). */
async function trackOrderPaid(orderId: string) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      totalMinor: true,
      buyerId: true,
      buyer: { select: { analyticsConsentAt: true } },
      items: { select: { quantity: true } },
    },
  });
  if (!order.buyerId || !order.buyer?.analyticsConsentAt) return;
  await captureEvent("order_paid", order.buyerId, {
    total_kes: order.totalMinor / 100,
    items: order.items.reduce((n, i) => n + i.quantity, 0),
  });
}

/** In-app notifications (and SMS for the two moments that need action) for each status change. */
async function notifyParties(order: Awaited<ReturnType<typeof loadOrderSummary>>, to: OrderStatus, input: ApplyInput) {
  const buyerUrl = `/account/orders/${order.id}`;
  const sellerUrl = `/sell/orders/${order.id}`;
  const toBuyer = (title: string, body: string, sms?: string) =>
    order.buyerId
      ? notify({
          userId: order.buyerId,
          type: `order.${to.toLowerCase()}`,
          inApp: { title, body, url: buyerUrl },
          sms: sms ? { text: sms, phone: order.buyerPhone } : undefined,
        })
      : undefined;
  const toSeller = (title: string, body: string, sms?: string) =>
    notify({
      userId: order.seller.user.id,
      type: `order.${to.toLowerCase()}`,
      inApp: { title, body, url: sellerUrl },
      sms: sms ? { text: sms } : undefined,
    });
  switch (to) {
    case "PAID_HELD":
      await toBuyer(`Order ${order.number} is paid`, "Your money is held safely until you confirm delivery.");
      await toSeller(
        `New order ${order.number}`,
        `Paid ${formatKes(order.totalMinor)}. Please send the item and mark it as shipped.`,
        `Soko: new paid order ${order.number} (${formatKes(order.totalMinor)}). Open your seller dashboard to ship it.`,
      );
      break;
    case "SHIPPED":
      await toBuyer(
        `Order ${order.number} is on the way`,
        "Confirm when it arrives so the seller is paid.",
        `Soko: your order ${order.number} is on the way. Confirm delivery in the app once it arrives.`,
      );
      break;
    case "COMPLETED":
      await toSeller(`Order ${order.number} completed`, "Your payout is on its way.");
      if (input.event === "funds_released") {
        await toBuyer(`How was order ${order.number}?`, "Leave a review to help other buyers.");
      }
      break;
    case "REFUNDED":
      await toBuyer(`Order ${order.number} refunded`, input.note ?? "Your payment is being refunded.");
      await toSeller(`Order ${order.number} refunded`, input.note ?? "The buyer was refunded.");
      break;
    case "CANCELLED":
      await toBuyer(`Order ${order.number} cancelled`, input.note ?? "The order was cancelled.");
      if (input.event !== "payment_expired") await toSeller(`Order ${order.number} cancelled`, input.note ?? "");
      break;
  }
}

/** Refunds every successful payment on an order. Safe to call again: refunded payments are skipped. */
export async function refundOrderPayments(orderId: string) {
  const gateway = getPaymentGateway();
  const payments = await db.payment.findMany({ where: { orderId, status: "SUCCEEDED" } });
  for (const payment of payments) {
    if (!gateway) throw new Error("No payment gateway configured for refund");
    await gateway.refund({ reference: payment.providerReference, amountMinor: payment.amountMinor });
    await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
    await audit({ action: "payment.refunded", targetType: "payment", targetId: payment.id, metadata: { orderId } });
  }
}

/** A listing whose stock (and every option's stock) is gone after a completed sale is marked sold. */
async function markSoldOutListings(listingIds: string[]) {
  for (const id of new Set(listingIds)) {
    const listing = await db.listing.findUnique({
      where: { id },
      select: { status: true, stock: true, variants: { select: { stock: true } } },
    });
    if (!listing || listing.status !== "ACTIVE") continue;
    const left = listing.variants.length ? listing.variants.some((v) => v.stock > 0) : listing.stock > 0;
    if (!left) {
      await db.listing.update({ where: { id }, data: { status: "SOLD" } });
      await syncListingToSearch(id);
    }
  }
}

/**
 * Housekeeping, run daily by cron and opportunistically before checkout:
 * cancels unpaid orders past their payment window (returning stock) and releases funds for
 * shipped orders whose confirmation window has passed without a dispute.
 */
export async function runOrderMaintenance(now = new Date()) {
  const expired = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", paymentDueAt: { lt: now } },
    select: { id: true },
    take: 200,
  });
  for (const { id } of expired) {
    await applyOrderEvent({
      orderId: id,
      event: "payment_expired",
      actorId: null,
      note: "Payment wasn't completed in time.",
    }).catch((error) => console.error("[orders] expiry failed", id, error));
  }
  const due = await db.order.findMany({
    where: { status: "SHIPPED", autoReleaseAt: { lt: now } },
    select: { id: true },
    take: 200,
  });
  for (const { id } of due) {
    await applyOrderEvent({
      orderId: id,
      event: "auto_released",
      actorId: null,
      note: "The confirmation window ended without a problem being reported.",
    }).catch((error) => console.error("[orders] auto-release failed", id, error));
  }
  const { retryPendingPayouts } = await import("./payouts");
  const payouts = await retryPendingPayouts();
  return { expired: expired.length, autoReleased: due.length, payoutsRetried: payouts };
}
