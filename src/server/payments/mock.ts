import "server-only";
import { db } from "@/server/db";
import type { PaymentGateway } from "./types";

/** Fixed secret for the mock gateway's webhooks. The mock only runs locally and in CI. */
export const MOCK_WEBHOOK_SECRET = "mock_webhook_secret_for_local_and_ci_only";

/**
 * Stands in for Paystack in development and tests. Card payments go to a local sandbox page
 * (/dev/payments/<reference>) where you approve or decline; that page sends a correctly signed
 * webhook through the same handler production uses.
 */
export function createMockGateway(): PaymentGateway {
  return {
    mode: "mock",
    webhookSecret: MOCK_WEBHOOK_SECRET,
    async initializeCardPayment({ reference, callbackUrl }) {
      const params = new URLSearchParams({ return: callbackUrl });
      return { authorizationUrl: `/dev/payments/${encodeURIComponent(reference)}?${params}` };
    },
    async chargeMpesa() {
      return { displayText: "Test mode: approve the payment on the sandbox page instead of your phone." };
    },
    async verify(reference) {
      const payment = await db.payment.findUnique({ where: { providerReference: reference } });
      if (!payment) return { status: "failed", amountMinor: 0, currency: "KES" };
      const status = payment.status === "SUCCEEDED" ? "success" : payment.status === "PENDING" ? "pending" : "failed";
      return { status, amountMinor: payment.amountMinor, currency: "KES" };
    },
    async refund({ reference }) {
      return { id: `mock_refund_${reference}` };
    },
    async createMpesaRecipient({ phone }) {
      return { recipientCode: `RCP_mock_${phone.slice(-4)}` };
    },
    async transfer({ reference }) {
      return { transferCode: `TRF_mock_${reference}` };
    },
  };
}
