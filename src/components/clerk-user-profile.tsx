"use client";

import { UserProfile } from "@clerk/nextjs";

/** Clerk's account settings, including two-step verification. Hash routing keeps it on one URL. */
export function ClerkUserProfile() {
  return <UserProfile routing="hash" />;
}
