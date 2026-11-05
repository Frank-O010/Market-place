import "server-only";
import { formatKes } from "@/lib/money";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { notify } from "@/server/notifications";
import { applyOrderEvent } from "@/server/orders/service";
import { getPaymentGateway } from "@/server/payments";

export type Resolution = "FULL_REFUND" | "PARTIAL_REFUND" | "RELEASE_TO_SELLER";

export class DisputeError extends Error {}

/**
 * Closes a dispute and moves the money: a full refund, a partial refund (taken from the
 * seller's share, with the rest released), or release to the seller. The dispute row is claimed
 * first so it can't be resolved twice.
 */
export async function resolveDispute(input: {
  disputeId: string;
  resolution: Resolution;
  refundAmountMinor?: number;
  note: string;
  actorId: string;
}) {
  const dispute = await db.dispute.findUniqueOrThrow({
    where: { id: input.disputeId },
    select: {
      id: true,
      status: true,
      order: {
        select: {
          id: true,
          number: true,
          status: true,
          buyerId: true,
          totalMinor: true,
          platformFeeMinor: true,
          seller: { select: { userId: true } },
          payments: {
            where: { status: "SUCCEEDED" },
            select: { id: true, providerReference: true, amountMinor: true },
          },
        },
      },
    },
  });
  const order = dispute.order;
  if (dispute.status === "RESOLVED" || order.status !== "DISPUTED") {
    throw new DisputeError("This dispute has already been resolved.");
  }
  const sellerShare = order.totalMinor - order.platformFeeMinor;
  let refund = 0;
  if (input.resolution === "PARTIAL_REFUND") {
    refund = Math.round(input.refundAmountMinor ?? 0);
    if (!(refund > 0 && refund < sellerShare)) {
      throw new DisputeError(`A partial refund must be more than KES 0 and less than ${formatKes(sellerShare)}.`);
    }
  }

  const claimed = await db.dispute.updateMany({
    where: { id: dispute.id, status: { not: "RESOLVED" } },
    data: {
      status: "RESOLVED",
      resolution: input.resolution,
      refundAmountMinor: input.resolution === "FULL_REFUND" ? order.totalMinor : refund || null,
      resolutionNote: input.note,
      resolvedById: input.actorId,
      resolvedAt: new Date(),
    },
  });
  if (claimed.count !== 1) throw new DisputeError("This dispute has already been resolved.");

  if (input.resolution === "PARTIAL_REFUND") {
    const payment = order.payments.find((p) => p.amountMinor >= refund);
    const gateway = getPaymentGateway();
    if (!payment || !gateway) throw new DisputeError("No payment found to refund.");
    await gateway.refund({ reference: payment.providerReference, amountMinor: refund });
    await db.payment.update({ where: { id: payment.id }, data: { status: "PARTIALLY_REFUNDED" } });
    await db.order.update({ where: { id: order.id }, data: { refundedMinor: refund } });
    await audit({
      action: "payment.partially_refunded",
      actorId: input.actorId,
      targetType: "payment",
      targetId: payment.id,
      metadata: { refund },
    });
  }

  await applyOrderEvent({
    orderId: order.id,
    event: input.resolution === "FULL_REFUND" ? "dispute_resolved_for_buyer" : "dispute_resolved_for_seller",
    actorId: input.actorId,
    note:
      input.resolution === "FULL_REFUND"
        ? `Dispute resolved with a full refund. ${input.note}`
        : input.resolution === "PARTIAL_REFUND"
          ? `Dispute resolved: ${formatKes(refund)} refunded to the buyer. ${input.note}`
          : `Dispute resolved in the seller's favour. ${input.note}`,
  });
  await audit({
    action: "dispute.resolved",
    actorId: input.actorId,
    targetType: "dispute",
    targetId: dispute.id,
    metadata: { resolution: input.resolution, refund },
  });

  const summary =
    input.resolution === "FULL_REFUND"
      ? "The buyer gets a full refund."
      : input.resolution === "PARTIAL_REFUND"
        ? `The buyer gets ${formatKes(refund)} back and the rest goes to the seller.`
        : "The payment is released to the seller.";
  if (order.buyerId) {
    await notify({
      userId: order.buyerId,
      type: "dispute.resolved",
      inApp: {
        title: `Problem with order ${order.number} resolved`,
        body: summary,
        url: `/account/orders/${order.id}`,
      },
    });
  }
  await notify({
    userId: order.seller.userId,
    type: "dispute.resolved",
    inApp: { title: `Problem with order ${order.number} resolved`, body: summary, url: `/sell/orders/${order.id}` },
  });
}
