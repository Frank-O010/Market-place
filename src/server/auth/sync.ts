import "server-only";
import { db } from "@/server/db";
import type { ProviderProfile } from "./identity";

/**
 * Create or refresh our user record from the auth provider's profile.
 * Roles and status are never taken from the provider; new users start as buyers.
 */
export async function upsertUserFromProvider(authProviderId: string, profile: ProviderProfile) {
  const name = profile.name?.trim() || profile.email?.split("@")[0] || "New user";
  const user = await db.user.upsert({
    where: { authProviderId },
    create: {
      authProviderId,
      name,
      email: profile.email,
      phone: profile.phone,
      emailVerified: profile.emailVerified,
      phoneVerified: profile.phoneVerified,
    },
    update: {
      name,
      email: profile.email,
      phone: profile.phone,
      emailVerified: profile.emailVerified,
      phoneVerified: profile.phoneVerified,
    },
  });
  await syncPhoneTier(user.id, profile.phoneVerified);
  return user;
}

/** A seller with a verified phone number gets the "Phone verified" tier (higher tiers are kept). */
export async function syncPhoneTier(userId: string, phoneVerified: boolean) {
  await db.sellerProfile.updateMany({
    where: { userId, verificationTier: phoneVerified ? "UNVERIFIED" : "PHONE_VERIFIED" },
    data: { verificationTier: phoneVerified ? "PHONE_VERIFIED" : "UNVERIFIED" },
  });
}

/** Called when the provider tells us an account was deleted. Keeps financial records intact. */
export async function markUserDeleted(authProviderId: string) {
  await db.user.updateMany({
    where: { authProviderId },
    data: { status: "DELETED", deletedAt: new Date(), email: null, phone: null, name: "Deleted user" },
  });
}
