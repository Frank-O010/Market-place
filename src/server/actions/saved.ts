"use server";

import { z } from "zod";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";
import { expectedFailure, type ActionResult } from "./result";

const id = z.string().regex(/^[a-z0-9]{20,40}$/i);

/** Saves or un-saves a listing for the signed-in buyer. Only listings anyone can see can be saved. */
export async function setSaved(listingId: string, saved: boolean): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const user = await requireUser();
    await enforceRateLimit("saveItem", user.id);
    const listingIdParsed = id.parse(listingId);
    if (saved) {
      const listing = await db.listing.findUnique({ where: { id: listingIdParsed }, select: { status: true } });
      if (!listing || (listing.status !== "ACTIVE" && listing.status !== "SOLD")) {
        return { ok: false, error: "This item is no longer available." };
      }
      await db.savedItem.upsert({
        where: { userId_listingId: { userId: user.id, listingId: listingIdParsed } },
        create: { userId: user.id, listingId: listingIdParsed },
        update: {},
      });
    } else {
      await db.savedItem.deleteMany({ where: { userId: user.id, listingId: listingIdParsed } });
    }
    return { ok: true, data: { saved } };
  } catch (error) {
    return expectedFailure(error);
  }
}
