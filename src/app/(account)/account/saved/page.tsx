import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { listingCardSelect } from "@/server/queries/catalog";
import { ListingCard, ListingGridSkeleton } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Saved items", robots: { index: false } };

export default function SavedPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Saved items</h1>
      <Suspense fallback={<ListingGridSkeleton />}>
        <Saved />
      </Suspense>
    </div>
  );
}

async function Saved() {
  const user = await requireUserOrRedirect("/account/saved");
  // Scoped to the signed-in user; drafts and paused listings drop out until they're back on sale.
  const saved = await db.savedItem.findMany({
    where: { userId: user.id, listing: { status: { in: ["ACTIVE", "SOLD"] } } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { listing: { select: listingCardSelect } },
  });
  if (saved.length === 0) {
    return (
      <EmptyState
        icon={<Heart />}
        title="Nothing saved yet"
        description="Tap the heart on any item to keep it here for later."
        action={
          <Button asChild>
            <Link href="/">Browse listings</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {saved.map(({ listing }) => (
        <li key={listing.id}>
          <ListingCard listing={listing} />
        </li>
      ))}
    </ul>
  );
}
