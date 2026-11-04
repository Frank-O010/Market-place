import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Site search. A plain GET form for now, so it works without JavaScript.
 * Phase 2 wires it to Meilisearch with instant autocomplete.
 */
export function SearchBar({ className, defaultValue }: { className?: string; defaultValue?: string }) {
  return (
    <form action="/search" method="get" role="search" className={cn("relative w-full", className)}>
      <label htmlFor="site-search" className="sr-only">
        Search listings
      </label>
      <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" aria-hidden />
      <input
        id="site-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search phones, sofas, shoes…"
        autoComplete="off"
        enterKeyHint="search"
        className="border-border-strong bg-surface placeholder:text-muted h-11 w-full rounded-full border pr-4 pl-10 text-base"
      />
    </form>
  );
}
