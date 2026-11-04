import "server-only";
import { UnauthenticatedError } from "@/server/auth/current-user";
import { ForbiddenError } from "@/server/policy/can";
import { RateLimitError } from "@/server/rate-limit";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Turns expected failures (not signed in, not allowed, too many attempts) into a message
 * the form can show. Anything else is a bug and is re-thrown so Sentry sees it.
 */
export function expectedFailure(error: unknown): { ok: false; error: string } {
  if (error instanceof UnauthenticatedError || error instanceof ForbiddenError || error instanceof RateLimitError) {
    return { ok: false, error: error.message };
  }
  throw error;
}
