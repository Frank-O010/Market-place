import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/**
 * Public catalogue reads. These only ever return ACTIVE (or, for a product page, SOLD)
 * listings, so they are safe for signed-out visitors and can be cached on the server.
 * Cache tags are refreshed by listingChanged() whenever a seller edits something.
 */

const publicStatuses = ["ACTIVE", "SOLD"] as const;

export const listingCardSelect = {
  id: true,
  slug: true,
  title: true,
  priceMinor: true,
  location: true,
  condition: true,
  status: true,
  category: { select: { name: true } },
  images: {
    where: { status: "READY" },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    take: 1,
    select: { storageKey: true, altText: true, width: true, height: true },
  },
  seller: {
    select: { displayName: true, slug: true, ratingAverage: true, ratingCount: true, verificationTier: true },
  },
} satisfies Prisma.ListingSelect;

export type ListingCardData = Prisma.ListingGetPayload<{ select: typeof listingCardSelect }>;

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

/** Full category tree, for the listing editor and the sitemap. */
export async function getCategoryTree() {
  "use cache";
  cacheLife("hours");
  cacheTag("categories");
  return db.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      children: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true } },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("categories");
  return db.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      parent: { select: { name: true, slug: true } },
      children: { orderBy: { sortOrder: "asc" }, select: { name: true, slug: true } },
    },
  });
}

export async function getLatestListings(limit = 12) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");
  return db.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: listingCardSelect,
  });
}

/** Cards for search results, in the order the search engine ranked them. */
export async function getListingCards(ids: string[]) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");
  if (ids.length === 0) return [];
  const rows = await db.listing.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: listingCardSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is ListingCardData => Boolean(row));
}

export async function getPublicListing(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings", `listing:${id}`);
  return db.listing.findFirst({
    where: { id, status: { in: [...publicStatuses] } },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      condition: true,
      priceMinor: true,
      currency: true,
      stock: true,
      status: true,
      location: true,
      attributes: true,
      publishedAt: true,
      updatedAt: true,
      categoryId: true,
      category: { select: { name: true, slug: true, parent: { select: { name: true, slug: true } } } },
      images: {
        where: { status: "READY" },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, storageKey: true, altText: true, width: true, height: true },
      },
      variants: { orderBy: { name: "asc" }, select: { id: true, name: true, priceOverrideMinor: true, stock: true } },
      seller: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          location: true,
          verificationTier: true,
          ratingAverage: true,
          ratingCount: true,
          badges: true,
          createdAt: true,
        },
      },
    },
  });
}

export type PublicListing = NonNullable<Awaited<ReturnType<typeof getPublicListing>>>;

export async function getSimilarListings(categoryId: string, excludeId: string, limit = 8) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");
  return db.listing.findMany({
    where: { categoryId, status: "ACTIVE", id: { not: excludeId } },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: listingCardSelect,
  });
}

export async function getPublicSeller(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("sellers", `seller-slug:${slug}`);
  const seller = await db.sellerProfile.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      displayName: true,
      bio: true,
      location: true,
      verificationTier: true,
      ratingAverage: true,
      ratingCount: true,
      badges: true,
      createdAt: true,
      user: { select: { status: true } },
    },
  });
  if (!seller || seller.user.status !== "ACTIVE") return null;
  cacheTag(`seller:${seller.id}`);
  const { user: _user, ...rest } = seller;
  return rest;
}

export async function getSellerListings(sellerId: string, page: number, perPage = 24) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings", `seller:${sellerId}`);
  const where = { sellerId, status: "ACTIVE" as const };
  const [items, total] = await Promise.all([
    db.listing.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: listingCardSelect,
    }),
    db.listing.count({ where }),
  ]);
  return { items, total };
}

/** Everything the sitemap lists. Capped well below the 50,000-URL sitemap limit. */
export async function getSitemapEntries() {
  "use cache";
  cacheLife("hours");
  cacheTag("listings", "categories", "sellers");
  const [categories, listings, sellers] = await Promise.all([
    db.category.findMany({ select: { slug: true } }),
    db.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      take: 40_000,
      select: { id: true, slug: true, updatedAt: true },
    }),
    db.sellerProfile.findMany({
      where: { user: { status: "ACTIVE" }, listings: { some: { status: "ACTIVE" } } },
      select: { slug: true, updatedAt: true },
    }),
  ]);
  return { categories, listings, sellers };
}
