import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star rating. `value` is 0-5 and may be fractional (e.g. 4.6). */
export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  const rounded = Math.round(value * 2) / 2;
  const label = `Rated ${value.toFixed(1)} out of 5${count !== undefined ? ` from ${count} reviews` : ""}`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", className)}>
      <span role="img" aria-label={label} className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            aria-hidden
            className={cn(
              "size-4",
              i <= rounded
                ? "fill-rating text-rating"
                : i - 0.5 === rounded
                  ? "fill-rating/50 text-rating"
                  : "text-border-strong",
            )}
          />
        ))}
      </span>
      <span aria-hidden className="font-medium">
        {value.toFixed(1)}
      </span>
      {count !== undefined && (
        <span aria-hidden className="text-muted">
          ({count})
        </span>
      )}
    </span>
  );
}
