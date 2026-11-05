import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, ShieldCheck, Store } from "lucide-react";
import { attributeLabel } from "@/config/category-attributes";
import { site } from "@/config/site";
import { imageUrl } from "@/lib/images";
import { conditionLabels } from "@/lib/listings/schema";
import { absoluteUrl, categoryPath, listingPath, parseListingParam, sellerPath } from "@/lib/urls";
import { getPublicListing, getSimilarListings, type PublicListing } from "@/server/queries/catalog";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { ListingGrid } from "@/components/listing-card";
import { PhotoGallery } from "@/components/photo-gallery";
import { SaveButton } from "@/components/saved-items";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PriceTag } from "@/components/ui/price-tag";
import { Rating } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";

async function load(params: Promise<{ listing: string }>) {
  const parsed = parseListingParam((await params).listing);
  return parsed ? getPublicListing(parsed.id) : null;
}

const verifiedTiers = new Set(["ID_VERIFIED", "BUSINESS_VERIFIED"]);

export async function generateMetadata({ params }: PageProps<"/l/[listing]">): Promise<Metadata> {
  const listing = await load(params);
  if (!listing) return { title: "Not found" };
  const cover = listing.images[0];
  const description = `${listing.description.slice(0, 150).replace(/\s+/g, " ")}${listing.description.length > 150 ? "…" : ""}`;
  return {
    title: `${listing.title} in ${listing.location}`,
    description,
    alternates: { canonical: listingPath(listing) },
    openGraph: {
      type: "website",
      title: listing.title,
      description,
      url: listingPath(listing),
      images: cover
        ? [{ url: absoluteImage(cover.storageKey), width: cover.width, height: cover.height, alt: cover.altText }]
        : undefined,
    },
  };
}

export default function ListingPage({ params }: PageProps<"/l/[listing]">) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <Listing params={params} />
    </Suspense>
  );
}

async function Listing({ params }: { params: Promise<{ listing: string }> }) {
  const listing = await load(params);
  // The proxy answers unknown or unpublished listings with a real 404 first; this is a fallback.
  if (!listing) notFound();
  const sold =
    listing.status === "SOLD" ||
    (listing.variants.length ? listing.variants.every((v) => v.stock <= 0) : listing.stock <= 0);
  const prices = listing.variants.map((v) => v.priceOverrideMinor ?? listing.priceMinor);
  const fromPrice = prices.length ? Math.min(listing.priceMinor, ...prices) : listing.priceMinor;
  const attributes = Object.entries((listing.attributes ?? {}) as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
  );

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          ...(listing.category.parent
            ? [{ name: listing.category.parent.name, href: categoryPath(listing.category.parent.slug) }]
            : []),
          { name: listing.category.name, href: categoryPath(listing.category.slug) },
          { name: listing.title, href: listingPath(listing) },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <PhotoGallery photos={listing.images} fallbackLabel={listing.category.name} />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{conditionLabels[listing.condition]}</Badge>
            {sold && <Badge variant="neutral">Sold out</Badge>}
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">{listing.title}</h1>
          <div>
            {prices.some((p) => p !== listing.priceMinor) && <span className="text-muted mr-1 text-sm">From</span>}
            <PriceTag amount={fromPrice} size="lg" />
          </div>
          <p className="text-muted flex items-center gap-1 text-sm">
            <MapPin className="size-4" aria-hidden /> {listing.location}, {site.launchCity}
          </p>
          {listing.variants.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="font-semibold">Options</h2>
              <ul className="divide-border border-border divide-y rounded-lg border">
                {listing.variants.map((variant) => (
                  <li key={variant.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <span>{variant.name}</span>
                    <span className="flex items-center gap-3">
                      <PriceTag amount={variant.priceOverrideMinor ?? listing.priceMinor} size="sm" />
                      {variant.stock <= 0 && <Badge variant="neutral">Sold out</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!sold && (
              <p className="border-brand bg-brand-subtle w-full rounded-md border p-3 text-sm">
                M-Pesa checkout is coming soon. Save this item and we&apos;ll keep it in your list.
              </p>
            )}
            {listing.status === "ACTIVE" && (
              <SaveButton listingId={listing.id} title={listing.title} variant="inline" />
            )}
          </div>
          <p className="text-muted flex items-start gap-2 text-sm">
            <ShieldCheck className="text-brand mt-0.5 size-5 shrink-0" aria-hidden />
            When you buy, your payment is held safely until you confirm the item arrived.
          </p>
          <SellerCard seller={listing.seller} />
        </div>
      </div>

      <section aria-labelledby="description-heading" className="flex max-w-3xl flex-col gap-2">
        <h2 id="description-heading" className="text-xl font-semibold">
          Description
        </h2>
        <p className="whitespace-pre-line">{listing.description}</p>
      </section>

      {attributes.length > 0 && (
        <section aria-labelledby="details-heading" className="flex max-w-3xl flex-col gap-2">
          <h2 id="details-heading" className="text-xl font-semibold">
            Details
          </h2>
          <dl className="divide-border border-border grid divide-y rounded-lg border">
            {attributes.map(([key, value]) => (
              <div key={key} className="grid grid-cols-2 gap-2 p-3 text-sm">
                <dt className="text-muted">{attributeLabel(key)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <Suspense fallback={null}>
        <Similar categoryId={listing.categoryId} excludeId={listing.id} />
      </Suspense>

      <ProductJsonLd listing={listing} sold={sold} />
    </div>
  );
}

function SellerCard({ seller }: { seller: PublicListing["seller"] }) {
  const rating = seller.ratingCount > 0 ? seller.ratingAverage / 100 : null;
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Store className="text-muted size-8 shrink-0" aria-hidden />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={sellerPath(seller.slug)} className="truncate font-semibold underline-offset-4 hover:underline">
            {seller.displayName}
          </Link>
          <div className="text-muted flex flex-wrap items-center gap-x-2 text-sm">
            {rating !== null ? <Rating value={rating} count={seller.ratingCount} /> : <span>New seller</span>}
            {verifiedTiers.has(seller.verificationTier) && (
              <span className="text-success inline-flex items-center gap-1">
                <BadgeCheck className="size-4" aria-hidden /> Verified
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

async function Similar({ categoryId, excludeId }: { categoryId: string; excludeId: string }) {
  const similar = await getSimilarListings(categoryId, excludeId);
  if (similar.length === 0) return null;
  return (
    <section aria-labelledby="similar-heading" className="flex flex-col gap-4">
      <h2 id="similar-heading" className="text-xl font-semibold">
        Similar items
      </h2>
      <ListingGrid listings={similar} />
    </section>
  );
}

function ProductJsonLd({ listing, sold }: { listing: PublicListing; sold: boolean }) {
  const conditionSchema =
    listing.condition === "NEW"
      ? "NewCondition"
      : listing.condition === "FOR_PARTS"
        ? "DamagedCondition"
        : "UsedCondition";
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: listing.title,
        description: listing.description.slice(0, 500),
        sku: listing.id,
        category: listing.category.name,
        image: listing.images.map((img) => absoluteImage(img.storageKey)),
        brand:
          typeof (listing.attributes as Record<string, unknown>)?.brand === "string"
            ? { "@type": "Brand", name: (listing.attributes as Record<string, string>).brand }
            : undefined,
        offers: {
          "@type": "Offer",
          url: absoluteUrl(listingPath(listing)),
          priceCurrency: listing.currency,
          price: (listing.priceMinor / 100).toFixed(2),
          itemCondition: `https://schema.org/${conditionSchema}`,
          availability: `https://schema.org/${sold ? "SoldOut" : "InStock"}`,
          seller: { "@type": "Organization", name: listing.seller.displayName },
          areaServed: { "@type": "City", name: site.launchCity },
        },
      }}
    />
  );
}

function absoluteImage(storageKey: string) {
  const url = imageUrl(storageKey, "full");
  return url.startsWith("http") ? url : absoluteUrl(url);
}

function ListingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Skeleton className="aspect-square w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
