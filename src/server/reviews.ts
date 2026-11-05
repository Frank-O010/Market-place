import "server-only";
import { updateTag } from "next/cache";
import { ratingSummary } from "@/lib/trust/schemas";
import { db } from "@/server/db";
import { tags } from "@/server/listings/cache";

/** Recomputes a seller's rating from their visible reviews, and refreshes their public pages. */
export async function refreshSellerRating(sellerId: string) {
  const reviews = await db.review.findMany({ where: { sellerId, hiddenAt: null }, select: { rating: true } });
  await db.sellerProfile.update({ where: { id: sellerId }, data: ratingSummary(reviews.map((r) => r.rating)) });
  updateTag(tags.seller(sellerId));
  updateTag(tags.listings);
  updateTag("sellers");
}
