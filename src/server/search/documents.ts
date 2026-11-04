import type { Prisma } from "@/generated/prisma/client";

/** What we send to the search index for one listing. Only ACTIVE listings are ever indexed. */
export type ListingDocument = {
  id: string;
  title: string;
  description: string;
  details: string[];
  categoryName: string;
  categorySlugs: string[];
  condition: string;
  priceMinor: number;
  location: string;
  sellerName: string;
  publishedAt: number;
};

export const listingDocumentSelect = {
  id: true,
  title: true,
  description: true,
  attributes: true,
  condition: true,
  priceMinor: true,
  location: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  category: { select: { name: true, slug: true, parent: { select: { slug: true } } } },
  seller: { select: { displayName: true } },
} satisfies Prisma.ListingSelect;

export type ListingForIndex = Prisma.ListingGetPayload<{ select: typeof listingDocumentSelect }>;

export function toListingDocument(listing: ListingForIndex): ListingDocument {
  const attributes = (listing.attributes ?? {}) as Record<string, unknown>;
  return {
    id: listing.id,
    title: listing.title,
    // The start of the description is enough for relevance and keeps the index small.
    description: listing.description.slice(0, 1000),
    details: Object.values(attributes).filter((v): v is string => typeof v === "string"),
    categoryName: listing.category.name,
    categorySlugs: [listing.category.slug, listing.category.parent?.slug].filter((s): s is string => Boolean(s)),
    condition: listing.condition,
    priceMinor: listing.priceMinor,
    location: listing.location,
    sellerName: listing.seller.displayName,
    publishedAt: Math.floor((listing.publishedAt ?? listing.createdAt).getTime() / 1000),
  };
}
