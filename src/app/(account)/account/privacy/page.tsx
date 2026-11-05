import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { AnalyticsChoice, DeleteAccountForm } from "@/components/privacy-forms";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Privacy and data", robots: { index: false } };

export default function PrivacyPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <h1 className="text-3xl font-bold">Privacy and your data</h1>
      <Suspense fallback={<Skeleton className="h-60 w-full" />}>
        <Privacy />
      </Suspense>
    </div>
  );
}

async function Privacy() {
  await requireUserOrRedirect("/account/privacy");
  return (
    <>
      <section aria-labelledby="export-heading" className="flex flex-col gap-2">
        <h2 id="export-heading" className="text-xl font-semibold">
          Download your data
        </h2>
        <p>Get a copy of everything we hold about you: your account, orders, listings, messages and reviews.</p>
        <Button asChild variant="secondary" className="self-start">
          <a href="/api/account/export" download>
            Download my data (JSON)
          </a>
        </Button>
      </section>
      <section aria-labelledby="analytics-heading" className="flex flex-col gap-2">
        <h2 id="analytics-heading" className="text-xl font-semibold">
          Analytics
        </h2>
        <p>We only count visits if you allow it. You can change your mind at any time.</p>
        <AnalyticsChoice />
      </section>
      <section aria-labelledby="delete-heading" className="flex flex-col gap-2">
        <h2 id="delete-heading" className="text-xl font-semibold">
          Delete your account
        </h2>
        <p>
          Your name, email, phone number, shop and listings are removed straight away. We keep records of past orders
          and payments because the law requires it, without your contact details. You can&apos;t delete your account
          while an order or payout is in progress.
        </p>
        <DeleteAccountForm />
      </section>
    </>
  );
}
