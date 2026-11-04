import "server-only";
import type { CurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { assertCan, can, ForbiddenError } from "@/server/policy/can";

/**
 * Loads a listing for its owner (or staff) to manage. Unknown ids and other sellers'
 * listings fail the same way, so a stranger can't tell which ids exist.
 */
export async function loadListingForUpdate(user: CurrentUser, listingId: string) {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, status: true },
  });
  if (!listing || !can(user, "view", "listing", listing)) throw new ForbiddenError("That listing wasn't found.");
  assertCan(user, "update", "listing", listing);
  return listing;
}
