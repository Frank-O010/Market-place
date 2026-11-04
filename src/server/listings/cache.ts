import "server-only";
import { after } from "next/server";
import { updateTag } from "next/cache";
import { syncListingToSearch } from "@/server/search";

/** Cache tags for public catalogue data. */
export const tags = {
  listings: "listings",
  listing: (id: string) => `listing:${id}`,
  seller: (sellerId: string) => `seller:${sellerId}`,
  categories: "categories",
};

/**
 * Call from a server action after a listing changes: refreshes the cached public pages
 * (so the seller sees the change straight away) and updates the search index after the response.
 */
export function listingChanged(listing: { id: string; sellerId: string }) {
  updateTag(tags.listings);
  updateTag(tags.listing(listing.id));
  updateTag(tags.seller(listing.sellerId));
  updateTag("sellers");
  after(() => syncListingToSearch(listing.id));
}
