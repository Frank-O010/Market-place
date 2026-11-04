/**
 * Processed listing photos are stored as "<storageKey>/<size>.webp".
 * Safe to import from client components (no server code).
 */
export const IMAGE_SIZES = { thumb: 200, card: 480, full: 1200 } as const;
export type ImageSize = keyof typeof IMAGE_SIZES;

export const MAX_PHOTOS_PER_LISTING = 8;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Types the browser may upload. HEIC is left out on purpose: iPhones convert to JPEG when it isn't offered. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function imageUrl(storageKey: string, size: ImageSize): string {
  const key = `${storageKey}/${size}.webp`;
  const origin = process.env.NEXT_PUBLIC_IMAGE_ORIGIN;
  return origin ? `${origin.replace(/\/$/, "")}/${key}` : `/api/uploads/file/${key}`;
}

/** srcSet covering every stored size; the browser picks the smallest that fits. */
export function imageSrcSet(storageKey: string): string {
  return (Object.keys(IMAGE_SIZES) as ImageSize[])
    .map((size) => `${imageUrl(storageKey, size)} ${IMAGE_SIZES[size]}w`)
    .join(", ");
}
