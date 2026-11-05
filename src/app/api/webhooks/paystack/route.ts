import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { securityEvent } from "@/server/security-events";
import { getPaymentGateway } from "@/server/payments";
import { verifyWebhookSignature } from "@/server/payments/signature";
import type { PaystackEvent } from "@/server/payments/types";
import { handlePaystackEvent } from "@/server/payments/webhook";

/**
 * Paystack webhook. Nothing is trusted until the HMAC-SHA512 signature over the raw body checks
 * out. Configure in Paystack: Settings > API Keys & Webhooks > Webhook URL = https://<site>/api/webhooks/paystack
 */
export async function POST(request: NextRequest) {
  const gateway = getPaymentGateway();
  if (!gateway) return new NextResponse("Payments are not configured", { status: 503 });

  const raw = await request.text();
  if (raw.length > 1_000_000) return new NextResponse("Payload too large", { status: 413 });
  if (!verifyWebhookSignature(gateway.webhookSecret, raw, request.headers.get("x-paystack-signature"))) {
    await securityEvent("webhook_signature_failed", {
      action: "webhook.paystack.bad_signature",
      ip: request.headers.get("x-forwarded-for"),
    });
    return new NextResponse("Invalid signature", { status: 401 });
  }
  let event: PaystackEvent;
  try {
    event = JSON.parse(raw) as PaystackEvent;
    if (typeof event?.event !== "string" || typeof event.data !== "object" || event.data === null)
      throw new Error("bad shape");
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }
  try {
    await handlePaystackEvent(event);
  } catch (error) {
    // Paystack retries non-2xx responses, which is what we want for unexpected failures.
    console.error("[webhook] paystack handler failed", event.event, error);
    Sentry.captureException(error, { tags: { area: "paystack-webhook" } });
    return new NextResponse("Handler error", { status: 500 });
  }
  return NextResponse.json({ received: true });
}
