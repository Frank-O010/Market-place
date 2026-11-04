import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { formatKes } from "@/lib/money";
import { imageUrl } from "@/lib/images";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { statusBadge } from "@/components/sell/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My listings", robots: { index: false } };

const statuses = {
  ALL: "All",
  ACTIVE: "Active",
  DRAFT: "Drafts",
  PAUSED: "Paused",
  SOLD: "Sold",
} as const;
type StatusFilter = keyof typeof statuses;


export default function MyListingsPage({ searchParams }: PageProps<"/sell/listings">) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">My listings</h1>
        <Button asChild>
          <Link href="/sell/listings/new">
            <Plus aria-hidden /> List an item
          </Link>
        </Button>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Listings searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Listings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUserOrRedirect("/sell/listings");
  if (!user.sellerProfileId) redirect("/sell/onboarding");
  const params = await searchParams;
  const raw = typeof params.status === "string" ? params.status : "ALL";
  const status: StatusFilter = raw in statuses ? (raw as StatusFilter) : "ALL";

  const listings = await db.listing.findMany({
    where: {
      sellerId: user.sellerProfileId,
      status: status === "ALL" ? { not: "REMOVED" } : status,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      status: true,
      priceMinor: true,
      stock: true,
      updatedAt: true,
      images: {
        where: { status: "READY" },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { storageKey: true },
      },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {params.deleted && (
        <p role="status" className="border-success bg-success-subtle rounded-md border p-3 text-sm">
          Listing deleted.
        </p>
      )}
      <nav aria-label="Filter by status">
        <ul className="flex flex-wrap gap-2">
          {(Object.keys(statuses) as StatusFilter[]).map((key) => (
            <li key={key}>
              <Link
                href={key === "ALL" ? "/sell/listings" : `/sell/listings?status=${key}`}
                aria-current={key === status ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium",
                  key === status ? "border-brand bg-brand-subtle" : "border-border-strong hover:bg-surface-muted",
                )}
              >
                {statuses[key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {listings.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={status === "ALL" ? "No listings yet" : `No ${statuses[status].toLowerCase()} listings`}
          description="List an item in a couple of minutes from your phone."
          action={
            <Button asChild>
              <Link href="/sell/listings/new">List an item</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-lg border">
          {listings.map((listing) => {
            const badge = statusBadge[listing.status]!;
            const cover = listing.images[0];
            return (
              <li key={listing.id} className="relative flex items-center gap-3 p-3">
                <div className="bg-surface-muted size-16 shrink-0 overflow-hidden rounded-md">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- thumbnail size is pre-generated
                    <img src={imageUrl(cover.storageKey, "thumb")} alt="" className="size-full object-cover" />
                  ) : (
                    <Package className="text-muted m-auto mt-4 size-8" aria-hidden />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`/sell/listings/${listing.id}/edit`}
                    className="truncate font-medium after:absolute after:inset-0"
                  >
                    {listing.title}
                  </Link>
                  <p className="text-muted text-sm">
                    {formatKes(listing.priceMinor)} · {listing.stock} in stock
                  </p>
                </div>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
