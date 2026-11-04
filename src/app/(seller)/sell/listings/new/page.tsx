import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { getCategoryTree } from "@/server/queries/catalog";
import { ListingForm } from "@/components/sell/listing-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "List an item", robots: { index: false } };

export default function NewListingPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">List an item</h1>
      <p className="text-muted">Step 1 of 2: details. You&apos;ll add photos next.</p>
      <Suspense fallback={<Skeleton className="h-[40rem] w-full max-w-2xl" />}>
        <NewListing />
      </Suspense>
    </div>
  );
}

async function NewListing() {
  const user = await requireUserOrRedirect("/sell/listings/new");
  if (!user.sellerProfileId || !user.roles.includes("SELLER")) redirect("/sell/onboarding");
  const [categories, seller] = await Promise.all([
    getCategoryTree(),
    db.sellerProfile.findUnique({ where: { id: user.sellerProfileId }, select: { location: true } }),
  ]);
  return (
    <ListingForm
      listingId={null}
      categories={categories}
      initial={{
        title: "",
        categoryId: "",
        condition: "",
        price: "",
        stock: "1",
        location: seller?.location ?? "",
        description: "",
        attributes: {},
        variants: [],
      }}
    />
  );
}
