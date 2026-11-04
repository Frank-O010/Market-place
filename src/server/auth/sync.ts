import "server-only";
import { db } from "@/server/db";
import type { ProviderProfile } from "./identity";

/**
 * Create or refresh our user record from the auth provider's profile.
 * Roles and status are never taken from the provider; new users start as buyers.
 */
export async function upsertUserFromProvider(authProviderId: string, profile: ProviderProfile) {
  const name = profile.name?.trim() || profile.email?.split("@")[0] || "New user";
  return db.user.upsert({
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
}

/** Called when the provider tells us an account was deleted. Keeps financial records intact. */
export async function markUserDeleted(authProviderId: string) {
  await db.user.updateMany({
    where: { authProviderId },
    data: { status: "DELETED", deletedAt: new Date(), email: null, phone: null, name: "Deleted user" },
  });
}
