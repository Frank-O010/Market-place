import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Who the auth provider says the visitor is. It never says what they may do:
 * roles and account status come from our own database, checked by the policy module.
 */
export type Identity = { authProviderId: string };

export type ProviderProfile = {
  email: string | null;
  phone: string | null;
  name: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
};

/** Cookie used only by the local dev sign-in (AUTH_PROVIDER=dev). Never enabled when deployed. */
export const DEV_SESSION_COOKIE = "mp_dev_session";

export async function getIdentity(): Promise<Identity | null> {
  if (env().AUTH_PROVIDER === "dev") {
    const value = (await cookies()).get(DEV_SESSION_COOKIE)?.value;
    return value ? { authProviderId: value } : null;
  }
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId ? { authProviderId: userId } : null;
}

/** Profile details from Clerk, used to create our user record on first sign-in. */
export async function getProviderProfile(): Promise<ProviderProfile | null> {
  if (env().AUTH_PROVIDER === "dev") return null;
  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  if (!user) return null;
  return {
    email: user.primaryEmailAddress?.emailAddress ?? null,
    phone: user.primaryPhoneNumber?.phoneNumber ?? null,
    name: user.fullName ?? user.username ?? null,
    emailVerified: user.primaryEmailAddress?.verification?.status === "verified",
    phoneVerified: user.primaryPhoneNumber?.verification?.status === "verified",
  };
}
