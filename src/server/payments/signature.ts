import { createHmac, timingSafeEqual } from "node:crypto";

/** Paystack signs webhooks with HMAC-SHA512 of the raw request body, using the secret key. */
export function signWebhook(secret: string, rawBody: string): string {
  return createHmac("sha512", secret).update(rawBody).digest("hex");
}

export function verifyWebhookSignature(secret: string, rawBody: string, signature: string | null): boolean {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = Buffer.from(signWebhook(secret, rawBody), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
