import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";
import { Skeleton } from "@/components/ui/skeleton";
import { DevAuthRedirect } from "../../dev-redirect";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function SignUpPage(props: PageProps<"/sign-up/[[...sign-up]]">) {
  if (process.env.AUTH_PROVIDER === "dev") {
    return (
      <Suspense>
        <DevAuthRedirect searchParams={props.searchParams} />
      </Suspense>
    );
  }
  // Clerk's <SignUp> reads the URL (usePathname), which is only known at request time,
  // so it must stream inside a Suspense boundary or the route can't be prerendered.
  return (
    <div className="flex justify-center py-6">
      <Suspense fallback={<Skeleton className="h-[30rem] w-full max-w-sm" />}>
        <SignUp />
      </Suspense>
    </div>
  );
}
