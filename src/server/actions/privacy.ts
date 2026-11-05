"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { ANON_ID_COOKIE, CONSENT_COOKIE } from "@/lib/analytics/events";
import { audit } from "@/server/audit";
import { getCurrentUser, requireUser } from "@/server/auth/current-user";
import { DEV_SESSION_COOKIE } from "@/server/auth/identity";
import { markUserDeleted } from "@/server/auth/sync";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { enforceRateLimit } from "@/server/rate-limit";
import { expectedFailure, type ActionResult } from "./result";

/** Cookie banner choice. Stored in a cookie (and on the account when signed in) for a year. */
export async function recordConsent(choice: "analytics" | "essential"): Promise<ActionResult> {
  const value = z.enum(["analytics", "essential"]).parse(choice);
  const jar = await cookies();
  jar.set(CONSENT_COOKIE, value, {
    httpOnly: false, // the page reads it to decide whether to send analytics events
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 365 * 86_400,
    path: "/",
  });
  if (value === "essential") jar.delete(ANON_ID_COOKIE);
  const user = await getCurrentUser();
  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: { analyticsConsentAt: value === "analytics" ? new Date() : null },
    });
  }
  return { ok: true };
}

const OPEN_ORDER_STATUSES = ["PENDING_PAYMENT", "PAID_HELD", "SHIPPED", "DELIVERED", "DISPUTED"] as const;

/**
 * Deletes the account: personal details are erased straight away (soft delete), while orders,
 * payments and payouts are kept as the law requires for financial records. Blocked while an
 * order or payout is still open, so nobody loses money.
 */
export async function deleteMyAccount(confirmText: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await enforceRateLimit("roleChange", user.id);
    if (confirmText.trim().toUpperCase() !== "DELETE") return { ok: false, error: "Type DELETE to confirm." };
    if (user.roles.includes("ADMIN"))
      return { ok: false, error: "Admins can't delete their own account here. Ask another admin." };
    const [openBuying, openSelling, pendingPayouts] = await Promise.all([
      db.order.count({ where: { buyerId: user.id, status: { in: [...OPEN_ORDER_STATUSES] } } }),
      user.sellerProfileId
        ? db.order.count({ where: { sellerId: user.sellerProfileId, status: { in: [...OPEN_ORDER_STATUSES] } } })
        : 0,
      user.sellerProfileId
        ? db.payout.count({
            where: { sellerId: user.sellerProfileId, status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
          })
        : 0,
    ]);
    if (openBuying + openSelling > 0) {
      return { ok: false, error: "You have orders in progress. Finish or cancel them first, then try again." };
    }
    if (pendingPayouts > 0) return { ok: false, error: "You have a payout on its way. Please wait until it's paid." };

    const account = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { authProviderId: true } });
    if (user.sellerProfileId) {
      await db.listing.updateMany({
        where: { sellerId: user.sellerProfileId, status: { in: ["ACTIVE", "PAUSED", "DRAFT", "PENDING_REVIEW"] } },
        data: { status: "REMOVED" },
      });
      await db.sellerProfile.update({
        where: { id: user.sellerProfileId },
        data: {
          bio: null,
          displayName: "Closed shop",
          payoutReference: null,
          payoutLabel: null,
          idDocumentKeyEnc: null,
        },
      });
    }
    await db.cart.deleteMany({ where: { userId: user.id } });
    await db.savedItem.deleteMany({ where: { userId: user.id } });
    await markUserDeleted(account.authProviderId);
    await audit({ action: "user.self_deleted", actorId: user.id, targetType: "user", targetId: user.id });
    if (env().AUTH_PROVIDER === "clerk") {
      const { clerkClient } = await import("@clerk/nextjs/server");
      await (await clerkClient()).users.deleteUser(account.authProviderId).catch((error: unknown) => {
        console.error("[privacy] Clerk delete failed; the account is already erased on our side", error);
      });
    } else {
      (await cookies()).delete(DEV_SESSION_COOKIE);
    }
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}
