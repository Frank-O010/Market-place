import type { Metadata } from "next";
import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthGate } from "../../auth-gate";
import { DevAuthRedirect } from "../../dev-redirect";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage(props: PageProps<"/sign-in/[[...sign-in]]">) {
  if (process.env.AUTH_PROVIDER === "dev") {
    return (
      <Suspense>
        <DevAuthRedirect searchParams={props.searchParams} />
      </Suspense>
    );
  }
  // Clerk's <SignIn> reads the URL (usePathname), which is only known at request time,
  // so it must stream inside a Suspense boundary or the route can't be prerendered.
  return (
    <div className="flex justify-center py-6">
      <Suspense fallback={<Skeleton className="h-[30rem] w-full max-w-sm" />}>
        <AuthGate>
          <SignIn />
        </AuthGate>
      </Suspense>
    </div>
  );
}
