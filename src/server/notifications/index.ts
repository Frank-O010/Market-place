import "server-only";
import { readNotificationPrefs, type NotificationPrefs } from "@/lib/trust/schemas";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import type { EmailContent } from "@/server/email/render";
import { sendSms } from "@/server/sms";

export type InAppPayload = { title: string; body: string; url: string };

type NotifyInput = {
  userId: string;
  type: string;
  inApp: InAppPayload;
  /** Sent unless the user turned this email off (pref) — omit pref for emails that always go. */
  email?: EmailContent & { pref?: keyof NotificationPrefs; orderId?: string };
  /** Sent to the user's phone if they allow order SMS. */
  sms?: { text: string; phone?: string | null };
};

/**
 * One place to tell someone something: an in-app notification (the bell), plus optional email
 * and SMS according to their notification settings. Never throws.
 */
export async function notify(input: NotifyInput) {
  try {
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: { email: true, phone: true, notificationPrefs: true, status: true },
    });
    if (!user || user.status === "DELETED") return;
    const prefs = readNotificationPrefs(user.notificationPrefs);
    await db.notification.create({
      data: { userId: input.userId, channel: "IN_APP", type: input.type, payload: input.inApp, sentAt: new Date() },
    });
    if (input.email && (!input.email.pref || prefs[input.email.pref])) {
      const { subject, html, text, orderId } = input.email;
      await sendEmail({ to: user.email, template: input.type, orderId, subject, html, text });
    }
    const phone = input.sms?.phone ?? user.phone;
    if (input.sms && prefs.orderSms && phone) {
      await sendSms({ userId: input.userId, phone: phone.replace(/^\+/, ""), text: input.sms.text, type: input.type });
    }
  } catch (error) {
    console.error("[notify] failed", input.type, error);
  }
}

/** Notifies every active moderator and admin (in-app only). */
export async function notifyStaff(type: string, inApp: InAppPayload) {
  const staff = await db.user.findMany({
    where: { status: "ACTIVE", roles: { hasSome: ["MODERATOR", "ADMIN"] } },
    select: { id: true },
    take: 50,
  });
  await db.notification.createMany({
    data: staff.map((s) => ({ userId: s.id, channel: "IN_APP" as const, type, payload: inApp, sentAt: new Date() })),
  });
}

export async function unreadNotificationCount(userId: string) {
  return db.notification.count({ where: { userId, channel: "IN_APP", readAt: null } });
}
