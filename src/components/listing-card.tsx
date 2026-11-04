import Link from "next/link";
import { BadgeCheck, MapPin, Package } from "lucide-react";
import { PriceTag } from "@/components/ui/price-tag";
import { Rating } from "@/components/ui/rating";
import type { ListingCardData } from "@/server/queries/catalog";

const verifiedTiers = new Set(["ID_VERIFIED", "BUSINESS_VERIFIED"]);

/** Product card: large image, price, title, seller rating and location at a glance. */
export function ListingCard({ listing }: { listing: ListingCardData }) {
  const image = listing.images[0];
  const rating = listing.seller.ratingCount > 0 ? listing.seller.ratingAverage / 100 : null;
  const verified = verifiedTiers.has(listing.seller.verificationTier);
  return (
    <article className="group border-border bg-surface shadow-card relative flex flex-col overflow-hidden rounded-lg border">
      <div className="bg-surface-muted relative aspect-square">
        {image ? (
          // Real images arrive with the Phase 2 image pipeline (next/image + R2 CDN).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/${image.storageKey}`} alt={image.altText} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="text-muted flex size-full flex-col items-center justify-center gap-2">
            <Package className="size-10" aria-hidden />
            <span className="text-xs">{listing.category.name}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <PriceTag amount={listing.priceMinor} size="sm" />
        <h3 className="line-clamp-2 text-sm font-medium">
          <Link href={`/l/${listing.slug}-${listing.id}`} className="after:absolute after:inset-0">
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
