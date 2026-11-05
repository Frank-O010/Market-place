import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

/** Link-based pagination so every page has a crawlable URL. */
export function Pagination({
  page,
  totalPages,
  hrefForPage,
  className,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const pages = pageWindow(page, totalPages);
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-1", className)}>
      <PageLink href={page > 1 ? hrefForPage(page - 1) : undefined} label="Previous page">
        <ChevronLeft />
      </PageLink>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="text-muted px-2" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefForPage(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(buttonVariants({ variant: p === page ? "primary" : "ghost", size: "icon" }))}
          >
            {p}
          </Link>
        ),
      )}
      <PageLink href={page < totalPages ? hrefForPage(page + 1) : undefined} label="Next page">
        <ChevronRight />
      </PageLink>
    </nav>
  );
}

function PageLink({ href, label, children }: { href?: string; label: string; children: React.ReactNode }) {
  const className = cn(buttonVariants({ variant: "ghost", size: "icon" }), !href && "pointer-events-none opacity-40");
  return href ? (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  ) : (
    // A link with no destination: announced as a disabled link rather than hidden.
    <a role="link" aria-label={label} aria-disabled="true" className={className}>
      {children}
    </a>
  );
}

export function pageWindow(page: number, total: number): (number | "…")[] {
  const set = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}
