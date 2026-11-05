import "server-only";
import { env } from "@/lib/env";
import { db } from "@/server/db";

/**
 * Sends an SMS through Africa's Talking and records it as an SMS notification. Without
 * AT_USERNAME/AT_API_KEY the message is only recorded (visible in the dev outbox locally).
 * Never throws: an SMS failure must not break an order update.
 */
export async function sendSms(input: { userId: string; phone: string; text: string; type: string }) {
  try {
    const record = await db.notification.create({
      data: { userId: input.userId, channel: "SMS", type: input.type, payload: { to: input.phone, text: input.text } },
      select: { id: true },
    });
    const { AT_USERNAME: username, AT_API_KEY: apiKey, AT_SENDER_ID: from } = env();
    if (!username || !apiKey) return;
    const sandbox = username === "sandbox";
    const body = new URLSearchParams({ username, to: `+${input.phone}`, message: input.text });
    if (from) body.set("from", from);
    const response = await fetch(
      sandbox
        ? "https://api.sandbox.africastalking.com/version1/messaging"
        : "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: { apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (response.ok) await db.notification.update({ where: { id: record.id }, data: { sentAt: new Date() } });
    else console.error("[sms] Africa's Talking returned", response.status);
  } catch (error) {
    console.error("[sms] failed to send", input.type, error);
  }
}
