import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@/generated/prisma/client";
import { formatKes } from "@/lib/money";
import { listingPath } from "@/lib/urls";
import { requireStaffPage } from "@/server/auth/staff";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";
import { AdminNav, pageParam, textParam, when } from "@/components/admin/admin-nav";
import { ListingModeration } from "@/components/admin/moderation-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Listings", robots: { index: false, follow: false } };

const PER_PAGE = 20;
const statuses = {
  ACTIVE: "Live",
  PENDING_REVIEW: "Waiting for review",
  DRAFT: "Draft",
  PAUSED: "Paused",
  SOLD: "Sold",
  REMOVED: "Removed",
} as const;
type Status = keyof typeof statuses;

export default function AdminListingsPage({ searchParams }: PageProps<"/admin/listings">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Listings</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Listings searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Listings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStaffPage("/admin/listings");
  const params = await searchParams;
  const q = textParam(params.q);
  const status = (Object.keys(statuses) as Status[]).find((s) => s === params.status);
  const page = pageParam(params.page);
  const where: Prisma.ListingWhereInput = {
    ...(status && { status }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { seller: { displayName: { contains: q, mode: "insensitive" } } },
        { id: q },
      ],
    }),
  };
  const [total, listings] = await Promise.all([
    db.listing.count({ where }),
    db.listing.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        priceMinor: true,
        updatedAt: true,
        moderationNote: true,
        seller: { select: { displayName: true, userId: true } },
      },
    }),
  ]);
  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (status) s.set("status", status);
    if (p > 1) s.set("page", String(p));
    return `/admin/listings${s.size ? `?${s}` : ""}`;
  };

  return (
    <>
      <AdminNav current="/admin/listings" isAdmin={can(user, "manage_settings", "platform", {})} />
      <form role="search" className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="listing-q">Title, shop or listing id</Label>
          <Input id="listing-q" name="q" type="search" defaultValue={q} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="listing-status">Status</Label>
          <NativeSelect id="listing-status" name="status" defaultValue={status ?? ""}>
            <option value="">Any status</option>
            {(Object.keys(statuses) as Status[]).map((s) => (
              <option key={s} value={s}>
                {statuses[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">Search</Button>
      </form>
      <p className="text-muted text-sm" aria-live="polite">
        {total} {total === 1 ? "listing" : "listings"}
      </p>
      <ul className="flex flex-col gap-3">
        {listings.map((l) => (
          <li key={l.id} className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                {l.status === "ACTIVE" || l.status === "SOLD" ? (
                  <Link
                    href={listingPath(l)}
                    className="inline-block min-h-6 font-medium underline-offset-2 hover:underline"
                  >
                    {l.title}
                  </Link>
                ) : (
                  <span className="font-medium">{l.title}</span>
                )}
                <p className="text-muted text-sm">
                  {formatKes(l.priceMinor)} ·{" "}
                  <Link href={`/admin/users/${l.seller.userId}`} className="underline">
                    {l.seller.displayName}
                  </Link>{" "}
                  · updated {when(l.updatedAt)}
                </p>
                {l.moderationNote && <p className="text-sm">Moderator note: {l.moderationNote}</p>}
              </div>
              <Badge variant={l.status === "ACTIVE" ? "success" : l.status === "REMOVED" ? "danger" : "neutral"}>
                {statuses[l.status]}
              </Badge>
            </div>
            {l.status !== "REMOVED" && l.status !== "SOLD" && (
              <ListingModeration listingId={l.id} canApprove={l.status === "PENDING_REVIEW"} />
            )}
          </li>
        ))}
        {listings.length === 0 && <li className="text-muted">No listings match that search.</li>}
      </ul>
      <Pagination page={page} totalPages={Math.ceil(total / PER_PAGE)} hrefForPage={href} />
    </>
  );
}
