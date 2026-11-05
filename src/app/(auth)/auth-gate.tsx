"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignOutButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Only allow going back to a page on this site. */
function safeReturnPath(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/**
 * Shows Clerk's sign-in or sign-up form only to signed-out visitors.
 *
 * Clerk hides its own form from someone who is already signed in, which used to leave a blank
 * page when the browser had a session but the server didn't accept it (for example when the
 * Clerk keys in Vercel come from two different instances). Now that case explains itself and
 * offers a way out instead of a blank page.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const returnTo = safeReturnPath(useSearchParams().get("redirect_url"));

  if (!isLoaded) return <Skeleton className="h-[30rem] w-full max-w-sm" />;
  if (!isSignedIn) return <>{children}</>;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle as="h1">We couldn&apos;t confirm your sign-in</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p>
          You&apos;re signed in on this device, but Soko couldn&apos;t confirm it. Try again, or sign out and sign back
          in.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={returnTo}>Try again</Link>
          </Button>
          <SignOutButton redirectUrl={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`}>
            <Button variant="secondary">Sign out</Button>
          </SignOutButton>
        </div>
        <p className="text-muted text-sm">
          If this keeps happening, please tell us. Technical details are at{" "}
          <a href="/api/auth/status" className="underline">
            /api/auth/status
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
