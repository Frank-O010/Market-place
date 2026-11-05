import "server-only";
import { fraudFlagLabels, fraudFlags } from "@/lib/trust/fraud";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { notifyStaff } from "@/server/notifications";

/** Runs the fraud rules on a newly paid order and flags it (holding the payout) if any match. */
export async function checkOrderForFraud(orderId: string, now = new Date()) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      totalMinor: true,
      buyerPhone: true,
      buyerId: true,
      buyer: { select: { createdAt: true } },
      fraudFlags: true,
    },
  });
  if (!order.buyerId || !order.buyer || order.fraudFlags.length > 0) return [];
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
  const [failedPaymentsLast24h, phoneAccounts] = await Promise.all([
    // Failed attempts on orders that never got paid (a paid order's leftover attempts are also
    // marked failed when another attempt succeeds, so those don't count).
    db.payment.count({
      where: {
        status: "FAILED",
        createdAt: { gte: dayAgo },
        order: {
          buyerId: order.buyerId,
          id: { not: order.id },
          payments: { none: { status: { in: ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"] } } },
        },
      },
    }),
    order.buyerPhone
      ? db.order.findMany({
          where: { buyerPhone: order.buyerPhone, createdAt: { gte: monthAgo }, buyerId: { not: null } },
          distinct: ["buyerId"],
          select: { buyerId: true },
        })
      : Promise.resolve([]),
  ]);
  const flags = fraudFlags({
    buyerCreatedAt: order.buyer.createdAt,
    orderTotalMinor: order.totalMinor,
    failedPaymentsLast24h,
    accountsUsingPhoneLast30d: phoneAccounts.length,
    now,
  });
  if (flags.length === 0) return flags;
  await db.order.update({ where: { id: order.id }, data: { fraudFlags: flags } });
  await audit({ action: "order.fraud_flagged", targetType: "order", targetId: order.id, metadata: { flags } });
  await notifyStaff("staff.fraud_flag", {
    title: `Order ${order.number} needs a check`,
    body: flags.map((f) => fraudFlagLabels[f]).join(". "),
    url: "/admin/moderation?tab=orders",
  });
  return flags;
}
