import { Suspense } from "react";
import Link from "next/link";
import { ShieldCheck, Smartphone, Truck } from "lucide-react";
import { site } from "@/config/site";
import { getLatestListings } from "@/server/queries/catalog";
import { ListingGrid, ListingGridSkeleton } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="bg-brand-subtle flex flex-col gap-4 rounded-xl p-6 sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{site.tagline}</h1>
        <p className="text-foreground/80 max-w-xl text-base">
          Your money is held safely until you confirm the item arrived. Pay with M-Pesa or card.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/sell">Start selling</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="#latest">Browse listings</Link>
          </Button>
        </div>
        <ul className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
          <li className="flex items-center gap-2">
            <ShieldCheck className="text-brand size-5" aria-hidden /> Payment held until delivery
          </li>
          <li className="flex items-center gap-2">
            <Smartphone className="text-brand size-5" aria-hidden /> M-Pesa checkout
          </li>
          <li className="flex items-center gap-2">
            <Truck className="text-brand size-5" aria-hidden /> Verified sellers
          </li>
        </ul>
      </section>

      <section id="latest" aria-labelledby="latest-heading" className="flex flex-col gap-4">
        <h2 id="latest-heading" className="text-2xl font-semibold">
          Latest in {site.launchCity}
        </h2>
        <Suspense fallback={<ListingGridSkeleton />}>
          <LatestListings />
        </Suspense>
      </section>
    </div>
  );
}

async function LatestListings() {
  const listings = await getLatestListings(12);
  if (listings.length === 0) {
    return (
      <EmptyState
        title="No listings yet"
        description="Be the first to list something for sale."
        action={
          <Button asChild>
            <Link href="/sell">List an item</Link>
          </Button>
        }
      />
    );
  }
  return <ListingGrid listings={listings} priorityCount={2} />;
}
