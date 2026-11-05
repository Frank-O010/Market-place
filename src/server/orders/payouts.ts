import "server-only";
import { after } from "next/server";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { getPaymentGateway } from "@/server/payments";
import { PaymentProviderError } from "@/server/payments/types";

/**
 * Seller payouts. One payout per completed order: the order total minus commission.
 * Sent to the seller's M-Pesa through a Paystack transfer; the transfer webhook marks it paid.
 */
export async function createPayoutForOrder(orderId: string) {
  const payoutId = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true, sellerId: true, totalMinor: true, platformFeeMinor: true, payoutId: true },
    });
    if (order.status !== "COMPLETED") throw new Error(`Order ${orderId} is not completed`);
    if (order.payoutId) return order.payoutId; // already created: idempotent
    const payout = await tx.payout.create({
      data: {
        sellerId: order.sellerId,
        amountMinor: order.totalMinor - order.platformFeeMinor,
        feeMinor: order.platformFeeMinor,
      },
      select: { id: true },
    });
    await tx.order.update({ where: { id: orderId }, data: { payoutId: payout.id } });
    return payout.id;
  });
  await sendPayout(payoutId);
  return payoutId;
}

/** Starts the transfer if the seller has payout details; otherwise the payout waits. */
export async function sendPayout(payoutId: string) {
  const gateway = getPaymentGateway();
  const payout = await db.payout.findUniqueOrThrow({
    where: { id: payoutId },
    select: { id: true, status: true, amountMinor: true, seller: { select: { payoutReference: true } } },
  });
  if (payout.status !== "PENDING" && payout.status !== "FAILED") return;
  const recipient = payout.seller.payoutReference;
  if (!gateway || !recipient) return; // waits until the seller adds an M-Pesa number

  // Claim it first so two runs can't both send money.
  const claimed = await db.payout.updateMany({
    where: { id: payout.id, status: payout.status },
    data: { status: "PROCESSING", providerReference: payout.id, failureReason: null },
  });
  if (claimed.count !== 1) return;
  try {
    await gateway.transfer({
      amountMinor: payout.amountMinor,
      recipientCode: recipient,
      reference: payout.id,
      reason: "Soko sales payout",
    });
    await audit({
      action: "payout.sent",
      targetType: "payout",
      targetId: payout.id,
      metadata: { amountMinor: payout.amountMinor },
    });
  } catch (error) {
    const reason = error instanceof PaymentProviderError ? (error.providerMessage ?? error.message) : String(error);
    await db.payout.update({
      where: { id: payout.id },
      data: { status: "FAILED", failureReason: reason.slice(0, 300) },
    });
    await audit({ action: "payout.failed", targetType: "payout", targetId: payout.id, metadata: { reason } });
    return;
  }
  if (gateway.mode === "mock") {
    // The mock gateway has no real transfer webhook; simulate Paystack's after the response.
    after(async () => {
      const { handlePaystackEvent } = await import("@/server/payments/webhook");
      await handlePaystackEvent({ event: "transfer.success", data: { reference: payout.id } });
    });
  }
}

export async function retryPendingPayouts() {
  const pending = await db.payout.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, seller: { payoutReference: { not: null } } },
    select: { id: true },
    take: 100,
  });
  for (const { id } of pending)
    await sendPayout(id).catch((error) => console.error("[payouts] retry failed", id, error));
  return pending.length;
}
