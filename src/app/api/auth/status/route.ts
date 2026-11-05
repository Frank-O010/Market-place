import { headers } from "next/headers";
import { NextResponse, connection } from "next/server";
import { env } from "@/lib/env";
import { describeClerkKeys } from "@/server/auth/clerk-diagnostics";
import { getIdentity } from "@/server/auth/identity";
import { RateLimitError, enforceRateLimit } from "@/server/rate-limit";
import { db } from "@/server/db";

/**
 * Explains why the server does or doesn't see the visitor as signed in. Shows only facts about
 * the visitor's own session and public facts about the Clerk setup, never keys or other people.
 * Linked from the sign-in page when the browser and the server disagree.
 */
export async function GET() {
  await connection();
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  try {
    await enforceRateLimit("authStatus", ip);
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    throw error;
  }

  const config = env();
  const identity = await getIdentity();
  let account: "signed-out" | "ok" | "not-created-yet" | "suspended" | "deleted" = "signed-out";
  if (identity) {
    const user = await db.user.findUnique({
      where: { authProviderId: identity.authProviderId },
      select: { status: true },
    });
    account = !user
      ? "not-created-yet"
      : user.status === "DELETED"
        ? "deleted"
        : user.status === "SUSPENDED"
          ? "suspended"
          : "ok";
  }

  const body = {
    signedIn: Boolean(identity),
    account,
    provider: config.AUTH_PROVIDER,
    clerk:
      config.AUTH_PROVIDER === "clerk"
        ? {
            // Set by Clerk's middleware on every request it handles; null means it didn't run.
            status: requestHeaders.get("x-clerk-auth-status"),
            reason: requestHeaders.get("x-clerk-auth-reason"),
            keys: await describeClerkKeys(config.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, config.CLERK_SECRET_KEY),
          }
        : null,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
