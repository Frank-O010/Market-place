import { Suspense } from "react";
import type { Metadata } from "next";
import { slugify } from "@/lib/utils";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { SellerProfileForm } from "@/components/sell/seller-profile-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Set up your shop", robots: { index: false } };

export default function OnboardingPage() {
  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-xl" />}>
        <Onboarding />
      </Suspense>
    </div>
  );
}

async function Onboarding() {
  const user = await requireUserOrRedirect("/sell/onboarding");
  const profile = await db.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { displayName: true, slug: true, location: true, bio: true, onboardedAt: true },
  });
  const editing = Boolean(profile?.onboardedAt);
  return (
    <>
      <h1 className="text-3xl font-bold">{editing ? "Shop details" : "Set up your shop"}</h1>
      {!editing && (
        <p className="text-muted max-w-xl">
          It takes a minute. You can change these later. You&apos;ll add your M-Pesa payout number before your first sale.
        </p>
      )}
      <SellerProfileForm
        submitLabel={editing ? "Save changes" : "Create my shop"}
        initial={{
          displayName: profile?.displayName ?? user.name,
          slug: profile?.onboardedAt ? profile.slug : slugify(user.name).slice(0, 40),
          location: profile?.location ?? "",
          bio: profile?.bio ?? "",
        }}
      />
    </>
  );
}
