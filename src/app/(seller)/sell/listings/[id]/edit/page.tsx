import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { listingPath } from "@/lib/urls";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";
import { getCategoryTree } from "@/server/queries/catalog";
import { ListingForm } from "@/components/sell/listing-form";
import { ListingStatusControls } from "@/components/sell/listing-status-controls";
import { PhotoManager } from "@/components/sell/photo-manager";
import { statusBadge } from "@/components/sell/status-badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };

export default function EditListingPage({ params, searchParams }: PageProps<"/sell/listings/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] w-full max-w-2xl" />}>
      <EditListing params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditListing({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const user = await requireUserOrRedirect(`/sell/listings/${id}/edit`);
  const listing = /^[a-z0-9]{20,40}$/i.test(id)
    ? await db.listing.findUnique({
        where: { id },
        select: {
          id: true,
          sellerId: true,
          slug: true,
          status: true,
          title: true,
          categoryId: true,
          condition: true,
          priceMinor: true,
          stock: true,
          location: true,
          description: true,
          attributes: true,
          variants: { orderBy: { name: "asc" }, select: { name: true, priceOverrideMinor: true, stock: true } },
          images: {
            where: { status: "READY" },
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            select: { id: true, storageKey: true, altText: true },
          },
        },
      })
    : null;
  // Other sellers' listings look exactly like missing ones.
  if (!listing || !can(user, "update", "listing", listing)) notFound();
  const firstStep = (await searchParams).step === "photos";
  const categories = await getCategoryTree();
  const badge = statusBadge[listing.status]!;
  const shillings = (minor: number) => String(minor / 100);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">{firstStep ? "Add photos" : "Edit listing"}</h1>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        {firstStep && <p className="text-muted">Step 2 of 2: add photos, then publish.</p>}
        {listing.status === "ACTIVE" && (
          <Link
            href={listingPath(listing)}
            className="text-brand inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            View live listing <ExternalLink className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      <PhotoManager listingId={listing.id} photos={listing.images} />
      <ListingStatusControls listingId={listing.id} status={listing.status} photoCount={listing.images.length} />
      <section aria-labelledby="details-heading" className="flex flex-col gap-4">
        <h2 id="details-heading" className="text-xl font-semibold">
          Details
        </h2>
        <ListingForm
          listingId={listing.id}
          categories={categories}
          initial={{
            title: listing.title,
            categoryId: listing.categoryId,
            condition: listing.condition,
            price: shillings(listing.priceMinor),
            stock: String(listing.stock),
            location: listing.location,
            description: listing.description,
            attributes: Object.fromEntries(
              Object.entries((listing.attributes ?? {}) as Record<string, unknown>).filter(
                (e): e is [string, string] => typeof e[1] === "string",
              ),
            ),
            variants: listing.variants.map((v) => ({
              name: v.name,
              price: v.priceOverrideMinor === null ? "" : shillings(v.priceOverrideMinor),
              stock: String(v.stock),
            })),
          }}
        />
      </section>
    </div>
  );
}
