import "server-only";
import { env } from "@/lib/env";

/**
 * True on a developer machine or in CI, where local stand-ins (disk photo storage, mock payments,
 * dev email outbox) may replace cloud services. Never true on Vercel.
 */
export function localFallbacksAllowed() {
  const e = env();
  if (e.VERCEL_ENV) return false;
  return e.NODE_ENV !== "production" || e.ALLOW_DEV_AUTH === "true";
}
