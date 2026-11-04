import type { Metadata } from "next";
import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";
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
  return (
    <div className="flex justify-center py-6">
      <SignIn />
    </div>
  );
}
