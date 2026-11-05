import { imageSrcSet, imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * A processed listing photo. Uses our own pre-made WebP sizes through srcSet, so no
 * on-the-fly image optimisation is needed and phones on slow connections get the small file.
 */
export function ListingPhoto({
  storageKey,
  alt,
  sizes,
  priority = false,
  className,
  width,
  height,
}: {
  storageKey: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sizes are pre-generated at upload
    <img
      src={imageUrl(storageKey, "card")}
      srcSet={imageSrcSet(storageKey)}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("object-cover", className)}
    />
  );
}
