import "server-only";
import { PaymentProviderError, type PaymentGateway } from "./types";

const API = "https://api.paystack.co";

type PaystackResponse<T> = { status: boolean; message: string; data: T };

/** Paystack REST client. Amounts are in the smallest unit (KES cents), the same as our minor units. */
export function createPaystackGateway(secretKey: string): PaymentGateway {
  async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${API}${path}`, {
        method: init.method ?? "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new PaymentProviderError("We couldn't reach the payment provider. Please try again.", String(error));
    }
    const json = (await response.json().catch(() => null)) as PaystackResponse<T> | null;
    if (!response.ok || !json?.status) {
      throw new PaymentProviderError(
        "The payment provider declined the request.",
        json?.message ?? `HTTP ${response.status}`,
      );
    }
    return json.data;
  }

  const localPhone = (phone: string) => `0${phone.slice(3)}`; // 2547XXXXXXXX -> 07XXXXXXXX

  return {
    mode: secretKey.startsWith("sk_live_") ? "paystack-live" : "paystack-test",
    webhookSecret: secretKey,
    async initializeCardPayment({ reference, email, amountMinor, callbackUrl }) {
      const data = await call<{ authorization_url: string }>("/transaction/initialize", {
        body: { email, amount: amountMinor, reference, currency: "KES", callback_url: callbackUrl, channels: ["card"] },
      });
      return { authorizationUrl: data.authorization_url };
    },
    async chargeMpesa({ reference, email, amountMinor, phone }) {
      const data = await call<{ status: string; display_text?: string }>("/charge", {
        body: {
          email,
          amount: amountMinor,
          currency: "KES",
          reference,
          mobile_money: { phone: `+${phone}`, provider: "mpesa" },
        },
      });
      if (data.status === "failed")
        throw new PaymentProviderError("M-Pesa couldn't start the payment.", data.display_text);
      return { displayText: data.display_text ?? "Check your phone and enter your M-Pesa PIN to pay." };
    },
    async verify(reference) {
      const data = await call<{ status: string; amount: number; currency: string }>(
        `/transaction/verify/${encodeURIComponent(reference)}`,
        { method: "GET" },
      );
      const status =
        data.status === "success"
          ? "success"
          : ["failed", "abandoned", "reversed"].includes(data.status)
            ? "failed"
            : "pending";
      return { status, amountMinor: data.amount, currency: data.currency };
    },
    async refund({ reference, amountMinor }) {
      const data = await call<{ id: number }>("/refund", { body: { transaction: reference, amount: amountMinor } });
      return { id: String(data.id) };
    },
    async createMpesaRecipient({ name, phone }) {
      const data = await call<{ recipient_code: string }>("/transferrecipient", {
        body: { type: "mobile_money", name, account_number: localPhone(phone), bank_code: "MPESA", currency: "KES" },
      });
      return { recipientCode: data.recipient_code };
    },
    async transfer({ amountMinor, recipientCode, reference, reason }) {
      const data = await call<{ transfer_code: string }>("/transfer", {
        body: { source: "balance", amount: amountMinor, recipient: recipientCode, reference, reason, currency: "KES" },
      });
      return { transferCode: data.transfer_code };
    },
  };
}
