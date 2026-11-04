import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/server/db";

/**
 * Public catalogue reads. These only ever return ACTIVE listings, so they are safe for
 * signed-out visitors and can be cached on the server.
 */

export async function getTopCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag("categories");
  return db.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export type ListingCardData = Awaited<ReturnType<typeof getLatestListings>>[number];

export async function getLatestListings(limit = 12) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");
  const listings = await db.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      priceMinor: true,
      location: true,
      condition: true,
      category: { select: { name: true } },
      images: {
        where: { scanned: true },
        orderBy: { position: "asc" },
        take: 1,
        select: { storageKey: true, altText: true, width: true, height: true },
      },
      seller: {
        select: { displayName: true, ratingAverage: true, ratingCount: true, verificationTier: true },
      },
    },
  });
  return listings;
}
