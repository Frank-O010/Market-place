import { formatKes, type MinorUnits } from "@/lib/money";
import { cn } from "@/lib/utils";

export function PriceTag({
  amount,
  compareAt,
  size = "md",
  className,
}: {
  amount: MinorUnits;
  /** Original price, shown struck through when higher than amount. */
  compareAt?: MinorUnits;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "text-base", md: "text-lg", lg: "text-2xl" } as const;
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className={cn("text-foreground font-bold", sizes[size])}>{formatKes(amount)}</span>
      {compareAt !== undefined && compareAt > amount && (
        <span className="text-muted text-sm line-through">
          <span className="sr-only">Was </span>
          {formatKes(compareAt)}
        </span>
      )}
    </span>
  );
}
