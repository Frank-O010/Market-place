import "server-only";
import { env } from "@/lib/env";
import { audit } from "@/server/audit";
import { decryptField } from "@/server/crypto";
import { db } from "@/server/db";
import { getPrivateStore } from "@/server/private-files";

const DAY = 86_400_000;
/** How long sent-email copies and old notifications are kept (they contain names and addresses). */
export const EMAIL_RETENTION_DAYS = 180;
export const NOTIFICATION_RETENTION_DAYS = 365;
/** IP addresses in the audit log are blanked after this long; the entries themselves stay. */
export const AUDIT_IP_RETENTION_DAYS = 365;

/**
 * The "hard delete" half of account deletion, plus routine clean-up (daily cron).
 *
 * When someone deletes their account we erase their name, email and phone straight away (soft
 * delete) but keep orders, payments and payouts, which the law requires as financial records.
 * After the retention period this removes what's left that could identify them: messages they
 * wrote, review text, dispute photos and text, ID documents, delivery addresses and phone numbers
 * on their orders, notifications and email copies. Amounts, dates and statuses stay.
 */
export async function purgeExpiredData(now = new Date()) {
  const cutoff = new Date(now.getTime() - env().DELETED_ACCOUNT_RETENTION_DAYS * DAY);
  const users = await db.user.findMany({
    where: { status: "DELETED", deletedAt: { lte: cutoff }, NOT: { authProviderId: { startsWith: "purged:" } } },
    select: {
      id: true,
      sellerProfile: { select: { id: true, idDocumentKeyEnc: true } },
      disputesOpened: { select: { id: true, evidenceKeys: true } },
    },
    take: 200,
  });
  const store = getPrivateStore();
  for (const user of users) {
    const keys = user.disputesOpened.flatMap((d) => d.evidenceKeys);
    if (user.sellerProfile?.idDocumentKeyEnc) {
      try {
        keys.push(decryptField(user.sellerProfile.idDocumentKeyEnc));
      } catch {
        // Undecryptable (key rotated): nothing we can find to delete.
      }
    }
    for (const key of keys) await store?.delete(key).catch(() => undefined);

    await db.$transaction([
      db.message.updateMany({ where: { senderId: user.id }, data: { body: "Message removed: account deleted." } }),
      db.review.updateMany({ where: { authorId: user.id }, data: { body: null } }),
      db.dispute.updateMany({
        where: { openedById: user.id },
        data: { details: "Removed: account deleted.", evidenceKeys: [] },
      }),
      db.order.updateMany({
        where: { buyerId: user.id },
        data: { buyerPhone: null, guestEmail: null, guestPhone: null },
      }),
      db.notification.deleteMany({ where: { userId: user.id } }),
      ...(user.sellerProfile
        ? [
            db.sellerProfile.update({
              where: { id: user.sellerProfile.id },
              data: { idDocumentKeyEnc: null, idReviewNote: null, payoutReference: null, payoutLabel: null },
            }),
          ]
        : []),
      // Unlinks the sign-in account for good and marks the purge as done.
      db.user.update({
        where: { id: user.id },
        data: { authProviderId: `purged:${user.id}`, notificationPrefs: {}, analyticsConsentAt: null },
      }),
    ]);
    // Delivery addresses are JSON; Prisma needs a raw update to set them to SQL NULL.
    await db.$executeRaw`UPDATE "Order" SET "deliveryAddress" = NULL WHERE "buyerId" = ${user.id}`;
    await audit({ action: "user.purged", targetType: "user", targetId: user.id });
  }

  const [emails, notifications, auditIps] = await Promise.all([
    db.emailMessage.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - EMAIL_RETENTION_DAYS * DAY) } } }),
    db.notification.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * DAY) } },
    }),
    db.auditLog.updateMany({
      where: { ip: { not: null }, createdAt: { lt: new Date(now.getTime() - AUDIT_IP_RETENTION_DAYS * DAY) } },
      data: { ip: null },
    }),
  ]);
  return {
    accountsPurged: users.length,
    emailsDeleted: emails.count,
    notificationsDeleted: notifications.count,
    auditIpsCleared: auditIps.count,
  };
}
