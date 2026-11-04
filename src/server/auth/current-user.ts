import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import type { Actor, Role } from "@/server/policy/can";
import { ForbiddenError } from "@/server/policy/can";
import { getIdentity, getProviderProfile } from "./identity";
import { upsertUserFromProvider } from "./sync";

export type CurrentUser = Actor & {
  name: string;
  email: string | null;
  sellerSlug: string | null;
};

export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor() {
    super("You need to sign in to do that.");
    this.name = "UnauthenticatedError";
  }
}

/**
 * The signed-in user, loaded from our database once per request.
 * Returns null when signed out. Suspended users are returned (so pages can explain why),
 * but the policy module denies them every action.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const identity = await getIdentity();
  if (!identity) return null;

  let user = await db.user.findUnique({
    where: { authProviderId: identity.authProviderId },
    include: { sellerProfile: { select: { id: true, slug: true } } },
  });

  // First request after signing up: the Clerk webhook may not have arrived yet, so create the record now.
  if (!user) {
    const profile = await getProviderProfile();
    if (!profile) return null;
    await upsertUserFromProvider(identity.authProviderId, profile);
    user = await db.user.findUnique({
      where: { authProviderId: identity.authProviderId },
      include: { sellerProfile: { select: { id: true, slug: true } } },
    });
    if (!user) return null;
  }

  if (user.status === "DELETED") return null;

  return {
    id: user.id,
    roles: user.roles,
    status: user.status,
    sellerProfileId: user.sellerProfile?.id ?? null,
    sellerSlug: user.sellerProfile?.slug ?? null,
    name: user.name,
    email: user.email,
  };
});

/** For pages: redirect signed-out visitors to sign in, and back here afterwards. */
export async function requireUserOrRedirect(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  return user;
}

/** For server actions and route handlers: throw a 401 instead of redirecting. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  if (user.status !== "ACTIVE") throw new ForbiddenError("Your account is suspended.");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.some((role) => user.roles.includes(role))) throw new ForbiddenError();
  return user;
}
