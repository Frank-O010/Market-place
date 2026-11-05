import "server-only";
import { env } from "@/lib/env";
import { localFallbacksAllowed } from "@/server/local-mode";
import { createMockGateway } from "./mock";
import { createPaystackGateway } from "./paystack";
import type { PaymentGateway } from "./types";

export type { PaymentGateway } from "./types";

let cached: PaymentGateway | null | undefined;

/**
 * Paystack when a secret key is set. Otherwise the mock gateway, but only where the dev tools
 * are allowed (local and CI). A deployed site without a key returns null: checkout is switched off.
 */
export function getPaymentGateway(): PaymentGateway | null {
  if (cached !== undefined) return cached;
  const key = env().PAYSTACK_SECRET_KEY;
  if (key) cached = createPaystackGateway(key);
  else if (localFallbacksAllowed()) cached = createMockGateway();
  else cached = null;
  return cached;
}
