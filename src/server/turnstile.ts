import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** Cloudflare Turnstile (bot check). Off unless both keys are set, so dev and tests skip it. */
export function turnstileEnabled() {
  const e = env();
  return Boolean(e.TURNSTILE_SECRET_KEY && e.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/** Checks a widget token with Cloudflare. Fails closed: any error counts as "not verified". */
export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || token.length > 2048) return false;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token, ...(ip && { remoteip: ip }) }),
      signal: AbortSignal.timeout(5000),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
