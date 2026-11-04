import Link from "next/link";
import { BadgeCheck, MapPin, Package } from "lucide-react";
import { ListingPhoto } from "@/components/listing-photo";
import { SaveButton } from "@/components/saved-items";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/ui/price-tag";
import { Rating } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";
import { listingPath } from "@/lib/urls";
import type { ListingCardData } from "@/server/queries/catalog";

const verifiedTiers = new Set(["ID_VERIFIED", "BUSINESS_VERIFIED"]);

/** Product card: large image, price, title, seller rating and location at a glance. */
export function ListingCard({
  listing,
  priority = false,
  showSave = true,
}: {
  listing: ListingCardData;
  priority?: boolean;
  showSave?: boolean;
}) {
  const image = listing.images[0];
  const rating = listing.seller.ratingCount > 0 ? listing.seller.ratingAverage / 100 : null;
  const verified = verifiedTiers.has(listing.seller.verificationTier);
  return (
    <article className="group border-border bg-surface shadow-card relative flex flex-col overflow-hidden rounded-lg border">
      <div className="bg-surface-muted relative aspect-square">
        {image ? (
          <ListingPhoto
            storageKey={image.storageKey}
            alt={image.altText}
            sizes="(min-width: 1024px) 18rem, (min-width: 640px) 33vw, 50vw"
            priority={priority}
            className="size-full"
          />
        ) : (
          <div className="text-muted flex size-full flex-col items-center justify-center gap-2">
            <Package className="size-10" aria-hidden />
            <span className="text-xs">{listing.category.name}</span>
          </div>
        )}
        {listing.status === "SOLD" && (
          <Badge variant="neutral" className="absolute top-2 left-2">
            Sold
          </Badge>
        )}
      </div>
      {showSave && listing.status === "ACTIVE" && <SaveButton listingId={listing.id} title={listing.title} />}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <PriceTag amount={listing.priceMinor} size="sm" />
        <h3 className="line-clamp-2 text-sm font-medium">
          <Link href={listingPath(listing)} className="after:absolute after:inset-0">
            {listing.title}
          </Link>
        </h3>
        <div className="text-muted mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {listing.location}
          </span>
          {rating !== null && <Rating value={rating} count={listing.seller.ratingCount} className="text-xs" />}
        </div>
        <p className="text-muted flex items-center gap-1 text-xs">
          <span className="truncate">{listing.seller.displayName}</span>
          {verified && (
            <span className="text-success inline-flex items-center gap-0.5">
              <BadgeCheck className="size-3.5" aria-hidden />
              <span>Verified</span>
            </span>
          )}
        </p>
      </div>
    </article>
  );
}

export function ListingGrid({ listings, priorityCount = 0 }: { listings: ListingCardData[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing, i) => (
        <li key={listing.id}>
          <ListingCard listing={listing} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export function ListingGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy aria-label="Loading listings">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
