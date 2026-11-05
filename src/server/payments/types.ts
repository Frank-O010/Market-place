/** What the app needs from a payment provider. Paystack in staging/production, a mock locally. */
export interface PaymentGateway {
  readonly mode: "paystack-test" | "paystack-live" | "mock";
  /** Card payment: returns the hosted checkout page to send the buyer to. */
  initializeCardPayment(input: {
    reference: string;
    email: string;
    amountMinor: number;
    callbackUrl: string;
  }): Promise<{ authorizationUrl: string }>;
  /** M-Pesa: sends an STK push to the buyer's phone. They confirm with their M-Pesa PIN. */
  chargeMpesa(input: { reference: string; email: string; amountMinor: number; phone: string }): Promise<{
    displayText: string;
  }>;
  /** Asks the provider for the final state of a payment (used to double-check webhooks and redirects). */
  verify(
    reference: string,
  ): Promise<{ status: "success" | "failed" | "pending"; amountMinor: number; currency: string }>;
  refund(input: { reference: string; amountMinor: number }): Promise<{ id: string }>;
  /** Registers a seller's M-Pesa number for payouts; returns the provider's recipient code. */
  createMpesaRecipient(input: { name: string; phone: string }): Promise<{ recipientCode: string }>;
  transfer(input: { amountMinor: number; recipientCode: string; reference: string; reason: string }): Promise<{
    transferCode: string;
  }>;
  /** Secret used to sign webhooks (HMAC-SHA512 of the raw body). */
  readonly webhookSecret: string;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly providerMessage?: string,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

/** The webhook events we act on, in Paystack's shape (only the fields we read). */
export type PaystackEvent =
  | { event: "charge.success"; data: { reference: string; amount: number; currency: string; channel?: string } }
  | { event: "charge.failed"; data: { reference: string; gateway_response?: string } }
  | { event: "transfer.success"; data: { reference: string; transfer_code?: string } }
  | { event: "transfer.failed" | "transfer.reversed"; data: { reference: string; reason?: string } }
  | { event: "refund.processed" | "refund.failed"; data: { transaction_reference: string } }
  | { event: string; data: Record<string, unknown> };
