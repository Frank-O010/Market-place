import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Named rate-limit policies. Keys are usually "<policy>:<user id or IP>".
 * Upstash Redis is used when configured; otherwise an in-memory limiter is used
 * (fine for local development and tests, not shared across server instances).
 */
export const RATE_LIMITS = {
  signIn: { limit: 10, windowSeconds: 60 },
  signUp: { limit: 5, windowSeconds: 600 },
  otp: { limit: 5, windowSeconds: 600 },
  passwordReset: { limit: 3, windowSeconds: 600 },
  message: { limit: 30, windowSeconds: 60 },
  listingCreate: { limit: 20, windowSeconds: 3600 },
  checkout: { limit: 10, windowSeconds: 600 },
  search: { limit: 60, windowSeconds: 60 },
  roleChange: { limit: 20, windowSeconds: 60 },
} as const;

export type RateLimitPolicy = keyof typeof RATE_LIMITS;

export type RateLimitResult = { success: boolean; remaining: number; resetAt: number };

export class RateLimitError extends Error {
  readonly status = 429;
  constructor(readonly resetAt: number) {
    super("Too many attempts. Please wait a moment and try again.");
    this.name = "RateLimitError";
  }
}

// --- In-memory fallback (fixed window) -------------------------------------------------------

const memory = new Map<string, { count: number; resetAt: number }>();

export function memoryLimit(key: string, limit: number, windowSeconds: number, now = Date.now()): RateLimitResult {
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { success: true, remaining: limit - 1, resetAt: now + windowSeconds * 1000 };
  }
  entry.count += 1;
  return { success: entry.count <= limit, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

export function resetMemoryLimits() {
  memory.clear();
}

// --- Upstash ---------------------------------------------------------------------------------

const upstashLimiters = new Map<RateLimitPolicy, Ratelimit>();

function upstashLimiter(policy: RateLimitPolicy): Ratelimit | null {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = env();
  if (!url || !token) return null;
  let limiter = upstashLimiters.get(policy);
  if (!limiter) {
    const { limit, windowSeconds } = RATE_LIMITS[policy];
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `rl:${policy}`,
      analytics: false,
    });
    upstashLimiters.set(policy, limiter);
  }
  return limiter;
}

export async function checkRateLimit(policy: RateLimitPolicy, identifier: string): Promise<RateLimitResult> {
  const limiter = upstashLimiter(policy);
  if (limiter) {
    const result = await limiter.limit(identifier);
    return { success: result.success, remaining: result.remaining, resetAt: result.reset };
  }
  const { limit, windowSeconds } = RATE_LIMITS[policy];
  return memoryLimit(`${policy}:${identifier}`, limit, windowSeconds);
}

/** Throws RateLimitError (429) when the identifier is over the policy's limit. */
export async function enforceRateLimit(policy: RateLimitPolicy, identifier: string) {
  const result = await checkRateLimit(policy, identifier);
  if (!result.success) throw new RateLimitError(result.resetAt);
  return result;
}
