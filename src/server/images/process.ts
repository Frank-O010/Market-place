import "server-only";
import sharp, { type Metadata } from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { ACCEPTED_IMAGE_TYPES, IMAGE_SIZES, type ImageSize } from "@/lib/images";

export class ImageRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRejectedError";
  }
}

/** Smallest photo we accept on its shorter side; anything smaller looks bad on a product page. */
export const MIN_IMAGE_SIDE = 300;
/** Refuse decompression bombs: 40 megapixels covers every phone camera. */
const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Checks the file's real type from its bytes (never trusting the name or the browser's
 * content type), then the dimensions.
 */
export async function sniffImage(bytes: Buffer): Promise<(typeof ACCEPTED_IMAGE_TYPES)[number]> {
  const type = await fileTypeFromBuffer(bytes);
  const mime = type?.mime as (typeof ACCEPTED_IMAGE_TYPES)[number] | undefined;
  if (!mime || !ACCEPTED_IMAGE_TYPES.includes(mime)) {
    if (type?.mime === "image/heic" || type?.mime === "image/heif") {
      throw new ImageRejectedError("HEIC photos aren't supported yet. Please choose a JPEG, PNG or WebP photo.");
    }
    throw new ImageRejectedError("That file isn't a photo we can use. Please choose a JPEG, PNG or WebP image.");
  }
  return mime;
}

export type ProcessedImage = { width: number; height: number; files: Record<ImageSize, Buffer> };

/**
 * Re-encodes an uploaded photo to WebP in every display size.
 * Re-encoding keeps only the pixels, so EXIF data (including GPS location) and anything
 * hidden in the original file are dropped. The photo is rotated upright first.
 */
export async function processImage(bytes: Buffer): Promise<ProcessedImage> {
  await sniffImage(bytes);
  const base = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
  let meta: Metadata;
  try {
    meta = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new ImageRejectedError("That photo couldn't be read. It may be damaged or too large.");
  }
  // EXIF orientations 5-8 mean the stored image is rotated 90 degrees.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;
  if (!width || !height || Math.min(width, height) < MIN_IMAGE_SIDE) {
    throw new ImageRejectedError(`Photos must be at least ${MIN_IMAGE_SIDE} pixels on each side.`);
  }

  const files = {} as Record<ImageSize, Buffer>;
  try {
    for (const [size, maxWidth] of Object.entries(IMAGE_SIZES) as [ImageSize, number][]) {
      files[size] = await base
        .clone()
        .resize({ width: maxWidth, height: maxWidth, fit: "inside", withoutEnlargement: true })
        .webp({ quality: size === "thumb" ? 70 : 80 })
        .toBuffer();
    }
  } catch {
    throw new ImageRejectedError("That photo couldn't be processed. Please try a different one.");
  }
  const scale = Math.min(1, IMAGE_SIZES.full / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale), files };
}
