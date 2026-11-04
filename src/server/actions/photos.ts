"use server";

import { z } from "zod";
import { ACCEPTED_IMAGE_TYPES, MAX_PHOTOS_PER_LISTING, MAX_UPLOAD_BYTES, type ImageSize } from "@/lib/images";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { ImageRejectedError, processImage } from "@/server/images/process";
import { listingChanged } from "@/server/listings/cache";
import { loadListingForUpdate } from "@/server/listings/owned";
import { ForbiddenError } from "@/server/policy/can";
import { enforceRateLimit } from "@/server/rate-limit";
import { getStorage } from "@/server/storage";
import { ObjectTooLargeError } from "@/server/storage/types";
import { expectedFailure, type ActionResult } from "./result";

/**
 * Photo upload in three steps, so large files never pass through our servers:
 *  1. requestPhotoUpload: checks permission and limits, returns a short-lived signed upload link.
 *  2. The browser PUTs the file straight to storage under incoming/.
 *  3. finishPhotoUpload: re-checks the real file type, re-encodes it (dropping EXIF/GPS),
 *     stores the public sizes under listings/ and deletes the original.
 */

const id = z.string().regex(/^[a-z0-9]{20,40}$/i);
const uploadRequest = z.object({
  contentType: z.enum(ACCEPTED_IMAGE_TYPES, { message: "Please choose a JPEG, PNG or WebP photo." }),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, `Photos can be up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`),
});

const NOT_CONFIGURED = "Photo uploads aren't switched on for this site yet. Please try again later.";

export async function requestPhotoUpload(
  listingId: string,
  file: { contentType: string; size: number },
): Promise<ActionResult<{ key: string; url: string; headers: Record<string, string> }>> {
  try {
    const user = await requireUser();
    const listing = await loadListingForUpdate(user, id.parse(listingId));
    const parsed = uploadRequest.safeParse(file);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    const storage = getStorage();
    if (!storage) return { ok: false, error: NOT_CONFIGURED };
    const count = await db.listingImage.count({ where: { listingId: listing.id, status: { not: "REJECTED" } } });
    if (count >= MAX_PHOTOS_PER_LISTING) {
      return { ok: false, error: `You can add up to ${MAX_PHOTOS_PER_LISTING} photos.` };
    }
    await enforceRateLimit("photoUpload", user.id);
    const key = `incoming/${listing.id}/${crypto.randomUUID()}`;
    const target = await storage.createUploadUrl({
      key,
      contentType: parsed.data.contentType,
      contentLength: parsed.data.size,
    });
    return { ok: true, data: { key, ...target } };
  } catch (error) {
    return expectedFailure(error);
  }
}

export async function finishPhotoUpload(
  listingId: string,
  key: string,
): Promise<ActionResult<{ id: string; storageKey: string; altText: string }>> {
  const storage = getStorage();
  try {
    const user = await requireUser();
    const listing = await loadListingForUpdate(user, id.parse(listingId));
    if (!storage) return { ok: false, error: NOT_CONFIGURED };
    // The key must be one we issued for this listing.
    const match = new RegExp(`^incoming/${listing.id}/[0-9a-f-]{36}$`).exec(key);
    if (!match) throw new ForbiddenError("That upload wasn't found.");

    let bytes: Buffer | null;
    try {
      bytes = await storage.getObject(key, MAX_UPLOAD_BYTES);
    } catch (error) {
      if (error instanceof ObjectTooLargeError) {
        await storage.deleteObjects([key]);
        return { ok: false, error: `Photos can be up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
      }
      throw error;
    }
    if (!bytes) return { ok: false, error: "The upload didn't finish. Please try again." };

    let processed;
    try {
      processed = await processImage(bytes);
    } catch (error) {
      if (error instanceof ImageRejectedError) return { ok: false, error: error.message };
      throw error;
    } finally {
      await storage.deleteObjects([key]).catch(() => undefined);
    }

    const storageKey = `listings/${listing.id}/${key.split("/").at(-1)}`;
    await Promise.all(
      (Object.entries(processed.files) as [ImageSize, Buffer][]).map(([size, file]) =>
        storage.putObject(`${storageKey}/${size}.webp`, file, "image/webp"),
      ),
    );

    const image = await db.$transaction(async (tx) => {
      const existing = await tx.listingImage.findMany({
        where: { listingId: listing.id, status: { not: "REJECTED" } },
        select: { position: true },
      });
      if (existing.length >= MAX_PHOTOS_PER_LISTING) throw new ForbiddenError(`You can add up to ${MAX_PHOTOS_PER_LISTING} photos.`);
      const details = await tx.listing.findUniqueOrThrow({ where: { id: listing.id }, select: { title: true } });
      return tx.listingImage.create({
        data: {
          listingId: listing.id,
          storageKey,
          width: processed.width,
          height: processed.height,
          position: Math.max(-1, ...existing.map((e) => e.position)) + 1,
          // A sensible default; the seller is prompted to describe the photo.
          altText: `${details.title}, photo ${existing.length + 1}`,
          status: "READY",
        },
        select: { id: true, storageKey: true, altText: true },
      });
    });
    listingChanged(listing);
    return { ok: true, data: image };
  } catch (error) {
    return expectedFailure(error);
  }
}

async function loadImageForUpdate(imageId: string) {
  const user = await requireUser();
  const image = await db.listingImage.findUnique({
    where: { id: id.parse(imageId) },
    select: { id: true, listingId: true, storageKey: true, position: true },
  });
  if (!image) throw new ForbiddenError("That photo wasn't found.");
  const listing = await loadListingForUpdate(user, image.listingId);
  await enforceRateLimit("listingUpdate", user.id);
  return { user, image, listing };
}

export async function deletePhoto(imageId: string): Promise<ActionResult> {
  try {
    const { image, listing } = await loadImageForUpdate(imageId);
    await db.listingImage.delete({ where: { id: image.id } });
    await getStorage()
      ?.deleteObjects(["thumb", "card", "full"].map((size) => `${image.storageKey}/${size}.webp`))
      .catch((error) => console.error("[photos] failed to delete files", error));
    listingChanged(listing);
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}

/** Moves a photo one place earlier or later. The first photo is the cover. */
export async function movePhoto(imageId: string, direction: "earlier" | "later"): Promise<ActionResult> {
  try {
    const { image, listing } = await loadImageForUpdate(imageId);
    const photos = await db.listingImage.findMany({
      where: { listingId: listing.id, status: "READY" },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const from = photos.findIndex((p) => p.id === image.id);
    const to = direction === "earlier" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= photos.length) return { ok: true };
    [photos[from], photos[to]] = [photos[to]!, photos[from]!];
    await db.$transaction(photos.map((p, position) => db.listingImage.update({ where: { id: p.id }, data: { position } })));
    listingChanged(listing);
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}

const altSchema = z.string().trim().min(3, "Describe the photo in a few words").max(150, "Keep it under 150 characters");

export async function updatePhotoAlt(imageId: string, altText: string): Promise<ActionResult> {
  try {
    const parsed = altSchema.safeParse(altText);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    const { image, listing } = await loadImageForUpdate(imageId);
    await db.listingImage.update({ where: { id: image.id }, data: { altText: parsed.data } });
    listingChanged(listing);
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}
