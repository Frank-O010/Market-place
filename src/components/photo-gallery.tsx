"use client";

import * as React from "react";
import { Package } from "lucide-react";
import { imageSrcSet, imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

type Photo = { id: string; storageKey: string; altText: string; width: number; height: number };

/** Main photo with a row of thumbnails. Works as a plain image list without JavaScript. */
export function PhotoGallery({ photos, fallbackLabel }: { photos: Photo[]; fallbackLabel: string }) {
  const [index, setIndex] = React.useState(0);
  const current = photos[index];
  if (!current) {
    return (
      <div className="bg-surface-muted text-muted flex aspect-square flex-col items-center justify-center gap-2 rounded-lg">
        <Package className="size-12" aria-hidden />
        <span className="text-sm">{fallbackLabel}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="bg-surface-muted aspect-square overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element -- sizes are pre-generated at upload */}
        <img
          key={current.id}
          src={imageUrl(current.storageKey, "full")}
          srcSet={imageSrcSet(current.storageKey)}
          sizes="(min-width: 1024px) 36rem, 100vw"
          alt={current.altText}
          width={current.width}
          height={current.height}
          fetchPriority={index === 0 ? "high" : undefined}
          className="size-full object-contain"
        />
      </div>
      {photos.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Photos">
          {photos.map((photo, i) => (
            <li key={photo.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1} of ${photos.length}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "bg-surface-muted block size-16 overflow-hidden rounded-md border-2",
                  i === index ? "border-brand" : "border-transparent",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail size is pre-generated */}
                <img src={imageUrl(photo.storageKey, "thumb")} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
