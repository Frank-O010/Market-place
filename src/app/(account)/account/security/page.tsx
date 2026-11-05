import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { ClerkUserProfile } from "@/components/clerk-user-profile";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign-in and security", robots: { index: false } };

export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Sign-in and security</h1>
      <p className="max-w-2xl">
        Change your password, phone number or email, and turn on two-step verification. Two-step verification is
        required for staff and for sellers who have been paid.
      </p>
      <Suspense fallback={<Skeleton className="h-[30rem] w-full" />}>
        <Security />
      </Suspense>
    </div>
  );
}

async function Security() {
  await requireUserOrRedirect("/account/security");
  if (process.env.AUTH_PROVIDER === "dev") {
    return (
      <p className="text-muted">Local development sign-in: security settings are managed by Clerk when deployed.</p>
    );
  }
  return <ClerkUserProfile />;
}
