"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, listingFormToInput, listingSchema } from "@/lib/listings/schema";
import { slugify } from "@/lib/utils";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { listingChanged } from "@/server/listings/cache";
import { loadListingForUpdate } from "@/server/listings/owned";
import { assertCan, ForbiddenError } from "@/server/policy/can";
import { enforceRateLimit } from "@/server/rate-limit";
import { getStorage } from "@/server/storage";
import { expectedFailure, type ActionResult } from "./result";

const idSchema = z.string().regex(/^[a-z0-9]{20,40}$/i, "Invalid id");

/** Creates (listingId = null) or updates a listing from the editor form. New listings start as drafts. */
export async function saveListing(
  listingId: string | null,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  let savedId: string;
  let created = false;
  try {
    const user = await requireUser();
    const parsed = listingSchema.safeParse(listingFormToInput(form));
    if (!parsed.success) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    }
    const data = parsed.data;
    const category = await db.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
    if (!category) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { categoryId: "Choose a category" } };

    const fields = {
      title: data.title,
      slug: slugify(data.title) || "item",
      description: data.description,
      condition: data.condition,
      priceMinor: data.price,
      stock: data.stock,
      location: data.location,
      categoryId: data.categoryId,
      attributes: data.attributes,
    };
    const variants = data.variants.map((v) => ({ name: v.name, stock: v.stock, priceOverrideMinor: v.price ?? null }));

    if (listingId) {
      const listing = await loadListingForUpdate(user, idSchema.parse(listingId));
      await enforceRateLimit("listingUpdate", user.id);
      await db.$transaction([
        db.listing.update({ where: { id: listing.id }, data: fields }),
        db.listingVariant.deleteMany({ where: { listingId: listing.id } }),
        db.listingVariant.createMany({ data: variants.map((v) => ({ ...v, listingId: listing.id })) }),
      ]);
      listingChanged(listing);
      savedId = listing.id;
    } else {
      if (!user.sellerProfileId) throw new ForbiddenError("Set up your shop before listing an item.");
      assertCan(user, "create", "listing", { sellerId: user.sellerProfileId, status: "DRAFT" });
      await enforceRateLimit("listingCreate", user.id);
      const listing = await db.listing.create({
        data: { ...fields, sellerId: user.sellerProfileId, status: "DRAFT", variants: { create: variants } },
        select: { id: true, sellerId: true },
      });
      await audit({ action: "listing.create", actorId: user.id, targetType: "listing", targetId: listing.id });
      savedId = listing.id;
      created = true;
    }
  } catch (error) {
    return expectedFailure(error);
  }
  // New listings go straight on to the photos step.
  if (created) redirect(`/sell/listings/${savedId}/edit?step=photos`);
  return { ok: true };
}

const statusSchema = z.enum(["ACTIVE", "PAUSED", "DRAFT"]);

/** Publish, pause or unpublish. Publishing needs at least one photo and something in stock. */
export async function setListingStatus(listingId: string, status: "ACTIVE" | "PAUSED" | "DRAFT"): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const listing = await loadListingForUpdate(user, idSchema.parse(listingId));
    const next = statusSchema.parse(status);
    await enforceRateLimit("listingUpdate", user.id);
    if (listing.status === "PENDING_REVIEW" || listing.status === "SOLD") {
      return { ok: false, error: "This listing can't be changed right now." };
    }
    if (next === "ACTIVE") {
      const full = await db.listing.findUniqueOrThrow({
        where: { id: listing.id },
        select: {
          stock: true,
          publishedAt: true,
          _count: { select: { images: { where: { status: "READY" } } } },
          variants: { select: { stock: true } },
        },
      });
      if (full._count.images === 0) return { ok: false, error: "Add at least one photo before publishing." };
      const inStock = full.variants.length ? full.variants.some((v) => v.stock > 0) : full.stock > 0;
      if (!inStock) return { ok: false, error: "Set the stock to at least 1 before publishing." };
      await db.listing.update({
        where: { id: listing.id },
        data: { status: "ACTIVE", publishedAt: full.publishedAt ?? new Date() },
      });
    } else {
      await db.listing.update({ where: { id: listing.id }, data: { status: next } });
    }
    await audit({
      action: `listing.status.${next.toLowerCase()}`,
      actorId: user.id,
      targetType: "listing",
      targetId: listing.id,
      metadata: { from: listing.status },
    });
    listingChanged(listing);
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}

/** Deletes a listing and its photos. Listings with orders are kept and marked removed instead. */
export async function deleteListing(listingId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = idSchema.parse(listingId);
    const listing = await db.listing.findUnique({
      where: { id },
      select: { id: true, sellerId: true, status: true, images: { select: { storageKey: true } }, _count: { select: { orderItems: true } } },
    });
    if (!listing) throw new ForbiddenError("That listing wasn't found.");
    assertCan(user, "delete", "listing", listing);
    await enforceRateLimit("listingUpdate", user.id);

    if (listing._count.orderItems > 0) {
      await db.listing.update({ where: { id }, data: { status: "REMOVED" } });
    } else {
      await db.listing.delete({ where: { id } });
      await getStorage()
        ?.deleteObjects(listing.images.flatMap((img) => ["thumb", "card", "full"].map((s) => `${img.storageKey}/${s}.webp`)))
        .catch((error) => console.error("[listings] failed to delete photos", error));
    }
    await audit({ action: "listing.delete", actorId: user.id, targetType: "listing", targetId: id });
    listingChanged(listing);
  } catch (error) {
    return expectedFailure(error);
  }
  redirect("/sell/listings?deleted=1");
}
