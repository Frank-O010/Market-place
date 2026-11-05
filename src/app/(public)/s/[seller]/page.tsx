import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Phone, Store } from "lucide-react";
import { z } from "zod";
import { sellerPath } from "@/lib/urls";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPublicSeller, getSellerListings, getSellerReviews } from "@/server/queries/catalog";
import { ReportButton } from "@/components/trust/report-button";
import { ReviewList } from "@/components/trust/review-list";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingGrid, ListingGridSkeleton } from "@/components/listing-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Rating } from "@/components/ui/rating";

const PER_PAGE = 24;
const verifiedTiers = new Set(["ID_VERIFIED", "BUSINESS_VERIFIED"]);

export async function generateMetadata({ params }: PageProps<"/s/[seller]">): Promise<Metadata> {
  const seller = await getPublicSeller((await params).seller);
  if (!seller) return { title: "Not found" };
  return {
    title: `${seller.displayName}${seller.location ? `, ${seller.location}` : ""}`,
    description: seller.bio || `Shop ${seller.displayName}'s listings. Payment held safely until delivery.`,
    alternates: { canonical: sellerPath(seller.slug) },
  };
}

export default function SellerPage({ params, searchParams }: PageProps<"/s/[seller]">) {
  return (
    <Suspense fallback={<ListingGridSkeleton />}>
      <Seller params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Seller({
  params,
  searchParams,
}: {
  params: Promise<{ seller: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const seller = await getPublicSeller((await params).seller);
  if (!seller) notFound();
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .catch(1)
    .parse((await searchParams).page);
  const { items, total } = await getSellerListings(seller.id, page, PER_PAGE);
  const rating = seller.ratingCount > 0 ? seller.ratingAverage / 100 : null;
  const since = new Intl.DateTimeFormat("en-KE", { month: "long", year: "numeric" }).format(seller.createdAt);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold sm:text-3xl">
          {seller.displayName}
          {verifiedTiers.has(seller.verificationTier) && (
            <span className="text-success inline-flex items-center gap-1 text-base font-medium">
              <BadgeCheck className="size-5" aria-hidden /> Verified
            </span>
          )}
          {seller.verificationTier === "PHONE_VERIFIED" && (
            <span className="text-muted inline-flex items-center gap-1 text-base font-medium">
              <Phone className="size-5" aria-hidden /> Phone verified
            </span>
          )}
        </h1>
        <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {rating !== null ? <Rating value={rating} count={seller.ratingCount} /> : <span>New seller</span>}
          {seller.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden /> {seller.location}
            </span>
          )}
          <span>Selling since {since}</span>
        </div>
        {seller.bio && <p className="max-w-2xl">{seller.bio}</p>}
      </header>
      <section aria-labelledby="seller-listings" className="flex flex-col gap-4">
        <h2 id="seller-listings" className="text-xl font-semibold">
          Listings ({total})
        </h2>
        {items.length ? (
          <ListingGrid listings={items} />
        ) : (
          <EmptyState icon={<Store />} title="No listings right now" description="Check back soon." />
        )}
        <Pagination
          page={page}
          totalPages={Math.ceil(total / PER_PAGE)}
          hrefForPage={(p) => (p > 1 ? `${sellerPath(seller.slug)}?page=${p}` : sellerPath(seller.slug))}
        />
      </section>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <Reviews sellerId={seller.id} sellerName={seller.displayName} sellerUserId={seller.userId} />
      </Suspense>
    </div>
  );
}

async function Reviews({
  sellerId,
  sellerName,
  sellerUserId,
}: {
  sellerId: string;
  sellerName: string;
  sellerUserId: string;
}) {
  const [reviews, user] = await Promise.all([getSellerReviews(sellerId), getCurrentUser()]);
  return (
    <section id="reviews" aria-labelledby="seller-reviews" className="flex scroll-mt-24 flex-col gap-4">
      <h2 id="seller-reviews" className="text-xl font-semibold">
        Reviews
      </h2>
      <ReviewList reviews={reviews} sellerName={sellerName} signedIn={Boolean(user)} />
      {user?.id !== sellerUserId && (
        <div>
          <ReportButton targetType="USER" targetId={sellerUserId} signedIn={Boolean(user)} />
        </div>
      )}
    </section>
  );
}
