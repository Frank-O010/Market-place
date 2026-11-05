import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, Clock, Phone } from "lucide-react";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { IdVerificationForm } from "@/components/sell/id-verification-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Get verified", robots: { index: false } };

const tierText = {
  UNVERIFIED: "Not verified yet",
  PHONE_VERIFIED: "Phone verified",
  ID_VERIFIED: "Verified (ID checked)",
  BUSINESS_VERIFIED: "Verified business",
} as const;

export default function VerificationPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Get verified</h1>
      <Suspense fallback={<Skeleton className="h-60 w-full" />}>
        <Verification />
      </Suspense>
    </div>
  );
}

async function Verification() {
  const user = await requireUserOrRedirect("/sell/verification");
  if (!user.sellerProfileId) {
    return (
      <Button asChild className="self-start">
        <Link href="/sell/onboarding">Set up your shop first</Link>
      </Button>
    );
  }
  const seller = await db.sellerProfile.findUniqueOrThrow({
    where: { id: user.sellerProfileId },
    select: {
      verificationTier: true,
      idVerificationStatus: true,
      idReviewNote: true,
      user: { select: { phoneVerified: true } },
    },
  });
  return (
    <>
      <p>
        Verified sellers get a badge on their shop and listings, which helps buyers trust you. Your listings also go
        live straight away, without a moderator check.
      </p>
      <p className="border-border rounded-lg border p-4" data-testid="verification-tier">
        Your status: <strong>{tierText[seller.verificationTier]}</strong>
      </p>
      <ol className="flex flex-col gap-4">
        <li className="flex gap-3">
          <Phone className="text-brand mt-1 size-5 shrink-0" aria-hidden />
          <div>
            <h2 className="font-semibold">1. Verify your phone number</h2>
            <p className="text-muted text-sm">
              {seller.user.phoneVerified
                ? "Done."
                : "Add and confirm your phone number in your account settings (we send a code by SMS)."}
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <BadgeCheck className="text-brand mt-1 size-5 shrink-0" aria-hidden />
          <div className="flex flex-1 flex-col gap-3">
            <h2 className="font-semibold">2. Verify your ID</h2>
            {seller.idVerificationStatus === "APPROVED" && (
              <p className="text-sm">Done. You have the Verified badge.</p>
            )}
            {seller.idVerificationStatus === "PENDING" && (
              <p className="flex items-center gap-2 text-sm" role="status">
                <Clock className="size-4" aria-hidden /> We&apos;re checking your ID. This usually takes up to 2 working
                days.
              </p>
            )}
            {(seller.idVerificationStatus === "NONE" || seller.idVerificationStatus === "REJECTED") && (
              <>
                {seller.idVerificationStatus === "REJECTED" && (
                  <p role="alert" className="border-warning bg-warning-subtle rounded-md border p-3 text-sm">
                    We couldn&apos;t approve your last photo: {seller.idReviewNote} Please try again.
                  </p>
                )}
                <IdVerificationForm />
              </>
            )}
          </div>
        </li>
      </ol>
    </>
  );
}
