import "server-only";
import * as Sentry from "@sentry/nextjs";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { latePaymentRefunded } from "@/server/email/templates";
import { applyOrderEvent } from "@/server/orders/service";
import { decideChargeFailed, decideChargeSuccess, decideTransfer } from "./decide";
import { getPaymentGateway } from "./index";
import type { PaystackEvent } from "./types";

/**
 * Applies a verified Paystack webhook event. Safe to receive the same event twice, or events
 * out of order: every branch checks the current state first (see decide.ts).
 */
export async function handlePaystackEvent(event: PaystackEvent): Promise<void> {
  switch (event.event) {
    case "charge.success":
      return onChargeSuccess(event.data as { reference: string; amount: number; currency: string }, event);
    case "charge.failed":
      return onChargeFailed(event.data as { reference: string; gateway_response?: string });
    case "transfer.success":
      return onTransfer((event.data as { reference: string }).reference, "success");
    case "transfer.failed":
    case "transfer.reversed":
      return onTransfer(
        (event.data as { reference: string }).reference,
        "failed",
        (event.data as { reason?: string }).reason,
      );
    default:
      return; // Events we don't use are acknowledged and ignored.
  }
}

async function onChargeSuccess(data: { reference: string; amount: number; currency: string }, raw: PaystackEvent) {
  const payment = await db.payment.findUnique({
    where: { providerReference: String(data.reference) },
    select: {
      id: true,
      status: true,
      amountMinor: true,
      orderId: true,
      order: { select: { status: true, buyer: { select: { email: true } } } },
    },
  });
  const decision = decideChargeSuccess(payment, payment?.order ?? null, {
    amount: Number(data.amount),
    currency: String(data.currency),
  });

  // Defence in depth with the real provider: confirm with Paystack before acting on money.
  const gateway = getPaymentGateway();
  if (decision.action !== "ignore" && gateway && gateway.mode !== "mock") {
    const verified = await gateway.verify(String(data.reference));
    if (verified.status !== "success" || verified.amountMinor !== Number(data.amount)) {
      await audit({
        action: "payment.verify_mismatch",
        targetType: "payment",
        targetId: payment?.id,
        metadata: { reference: data.reference },
      });
      return;
    }
  }

  switch (decision.action) {
    case "ignore":
      if (decision.reason === "unknown_reference") {
        await audit({ action: "payment.unknown_reference", metadata: { reference: String(data.reference) } });
      }
      return;
    case "flag_amount_mismatch":
      await audit({
        action: "payment.amount_mismatch",
        targetType: "payment",
        targetId: payment!.id,
        metadata: { expected: payment!.amountMinor, received: Number(data.amount), currency: String(data.currency) },
      });
      Sentry.captureMessage("Payment amount mismatch", { level: "error", extra: { reference: data.reference } });
      return;
    case "mark_paid": {
      const claimed = await db.payment.updateMany({
        where: { id: payment!.id, status: "PENDING" },
        data: { status: "SUCCEEDED", rawPayload: raw as object },
      });
      if (claimed.count !== 1) return; // a concurrent delivery of the same event won
      // Any other pending attempts for this order can no longer be used.
      await db.payment.updateMany({
        where: { orderId: payment!.orderId, status: "PENDING" },
        data: { status: "FAILED" },
      });
      await applyOrderEvent({
        orderId: payment!.orderId,
        event: "payment_succeeded",
        actorId: null,
        note: `Paid (${String(data.reference)})`,
      });
      return;
    }
    case "refund_late_payment": {
      const claimed = await db.payment.updateMany({
        where: { id: payment!.id, status: { in: ["PENDING", "FAILED"] } },
        data: { status: "SUCCEEDED", rawPayload: raw as object },
      });
      if (claimed.count !== 1) return;
      await gateway?.refund({ reference: String(data.reference), amountMinor: Number(data.amount) });
      await db.payment.update({ where: { id: payment!.id }, data: { status: "REFUNDED" } });
      await audit({
        action: "payment.late_refunded",
        targetType: "payment",
        targetId: payment!.id,
        metadata: { orderStatus: payment!.order.status },
      });
      await sendEmail({
        to: payment!.order.buyer?.email,
        template: "late_payment_refunded",
        orderId: payment!.orderId,
        ...latePaymentRefunded(String(data.reference), Number(data.amount)),
      });
      return;
    }
  }
}

async function onChargeFailed(data: { reference: string; gateway_response?: string }) {
  const payment = await db.payment.findUnique({
    where: { providerReference: String(data.reference) },
    select: { id: true, status: true, amountMinor: true },
  });
  if (decideChargeFailed(payment).action !== "mark_failed") return;
  await db.payment.updateMany({ where: { id: payment!.id, status: "PENDING" }, data: { status: "FAILED" } });
}

async function onTransfer(reference: string, outcome: "success" | "failed", reason?: string) {
  const payout = await db.payout.findUnique({
    where: { providerReference: String(reference) },
    select: { id: true, status: true },
  });
  const decision = decideTransfer(payout, outcome);
  if (decision === "ignore") return;
  if (decision === "mark_paid") {
    await db.payout.updateMany({
      where: { id: payout!.id, status: { not: "PAID" } },
      data: { status: "PAID", paidAt: new Date() },
    });
  } else {
    await db.payout.updateMany({
      where: { id: payout!.id, status: { not: "PAID" } },
      data: { status: "FAILED", failureReason: (reason ?? "The transfer failed").slice(0, 300) },
    });
  }
  await audit({ action: `payout.${decision}`, targetType: "payout", targetId: payout!.id });
}
