import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";
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
  return (
    <div className="flex justify-center py-6">
      <SignUp />
    </div>
  );
}
