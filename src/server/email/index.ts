import "server-only";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { localFallbacksAllowed } from "@/server/local-mode";
import type { EmailContent } from "./render";

/**
 * Sends an email through Resend and records it in EmailMessage. Without RESEND_API_KEY the
 * message is only recorded: locally it shows in the dev outbox (/dev/outbox).
 * Never throws: an email failure must not undo a payment or an order update.
 */
export async function sendEmail(
  input: EmailContent & { to: string | null | undefined; template: string; orderId?: string },
) {
  if (!input.to) return;
  try {
    const message = await db.emailMessage.create({
      data: {
        to: input.to,
        subject: input.subject,
        template: input.template,
        html: input.html,
        text: input.text,
        orderId: input.orderId,
      },
      select: { id: true },
    });
    const { RESEND_API_KEY: apiKey, EMAIL_FROM: from } = env();
    if (!apiKey) {
      await db.emailMessage.update({
        where: { id: message.id },
        data: localFallbacksAllowed()
          ? { status: "SENT", providerId: "dev-outbox", sentAt: new Date() }
          : { status: "FAILED", error: "RESEND_API_KEY is not set" },
      });
      return;
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Resend de-duplicates retries with the same key.
        "Idempotency-Key": message.id,
      },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    await db.emailMessage.update({
      where: { id: message.id },
      data: response.ok
        ? { status: "SENT", providerId: json.id ?? null, sentAt: new Date() }
        : { status: "FAILED", error: json.message ?? `HTTP ${response.status}` },
    });
  } catch (error) {
    console.error("[email] failed to send", input.template, error);
  }
}
