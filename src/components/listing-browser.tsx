import { TrackEvent } from "@/components/analytics";
import Link from "next/link";
import { SearchX, SlidersHorizontal } from "lucide-react";
import { nairobiAreas } from "@/config/locations";
import { conditionLabels, listingConditions } from "@/lib/listings/schema";
import { hasFilters, PER_PAGE, searchHref, sortOptions, type ListingSearch } from "@/lib/search-params";
import { getListingCards } from "@/server/queries/catalog";
import { searchListingIds } from "@/server/search";
import { ListingGrid } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";

const selectClass = "border-border-strong bg-surface h-11 w-full rounded-md border px-3 text-base";

/**
 * Results grid with filters, sorting and pagination. Used by search and category pages.
 * Filters are a plain GET form, so they work without JavaScript and every result page has a URL.
 */
export async function ListingBrowser({ search, basePath }: { search: ListingSearch; basePath: string }) {
  const { ids, total } = await searchListingIds(search);
  const tracking =
    basePath === "/search" && search.q && search.page === 1 ? (
      <TrackEvent event="search_performed" properties={{ query: search.q.slice(0, 100), results: total }} />
    ) : null;
  const listings = await getListingCards(ids);
  const totalPages = Math.min(50, Math.ceil(total / PER_PAGE));
  const filtered = hasFilters(search);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {tracking}
      <details className="border-border bg-surface rounded-lg border lg:w-64 lg:shrink-0" open={filtered || undefined}>
        <summary className="flex h-11 cursor-pointer items-center gap-2 px-4 font-medium">
          <SlidersHorizontal className="size-4" aria-hidden /> Filters{filtered ? " (on)" : ""}
        </summary>
        <form action={basePath} method="get" className="flex flex-col gap-4 p-4 pt-0">
          {search.q && <input type="hidden" name="q" value={search.q} />}
          {search.category && basePath === "/search" && <input type="hidden" name="category" value={search.category} />}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Price (KES)</legend>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="filter-min">
                Minimum price in shillings
              </label>
              <input
                id="filter-min"
                name="min"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Min"
                defaultValue={search.minPrice !== undefined ? search.minPrice / 100 : ""}
                className={selectClass}
              />
              <span aria-hidden>–</span>
              <label className="sr-only" htmlFor="filter-max">
                Maximum price in shillings
              </label>
              <input
                id="filter-max"
                name="max"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Max"
                defaultValue={search.maxPrice !== undefined ? search.maxPrice / 100 : ""}
                className={selectClass}
              />
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">Condition</legend>
            {listingConditions.map((condition) => (
              <label key={condition} className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="condition"
                  value={condition}
                  defaultChecked={search.conditions.includes(condition)}
                  className="size-5"
                />
                {conditionLabels[condition]}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-location" className="text-sm font-medium">
              Location
            </label>
            <select id="filter-location" name="location" defaultValue={search.location ?? ""} className={selectClass}>
              <option value="">Anywhere in Nairobi</option>
              {nairobiAreas.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-sort" className="text-sm font-medium">
              Sort by
            </label>
            <select id="filter-sort" name="sort" defaultValue={search.sort} className={selectClass}>
              {Object.entries(sortOptions)
                .filter(([value]) => value !== "relevance" || search.q)
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </div>
          <Button type="submit">Show results</Button>
          {filtered && (
            <Button asChild variant="ghost">
              <Link
                href={searchHref(basePath, {
                  ...search,
                  minPrice: undefined,
                  maxPrice: undefined,
                  conditions: [],
                  location: undefined,
                })}
              >
                Clear filters
              </Link>
            </Button>
          )}
        </form>
      </details>

      <section aria-label="Results" className="flex min-w-0 flex-1 flex-col gap-4">
        <p className="text-muted text-sm" role="status">
          {total === 0 ? "No results" : `${total.toLocaleString("en-KE")} ${total === 1 ? "result" : "results"}`}
          {search.q ? ` for “${search.q}”` : ""}
        </p>
        {listings.length > 0 ? (
          <ListingGrid listings={listings} priorityCount={search.page === 1 ? 2 : 0} />
        ) : (
          <EmptyState
            icon={<SearchX />}
            title="Nothing matches yet"
            description={
              filtered
                ? "Try removing a filter or widening the price range."
                : "Try a different word, or browse the categories above."
            }
          />
        )}
        <Pagination
          page={search.page}
          totalPages={totalPages}
          hrefForPage={(page) => searchHref(basePath, search, { page })}
        />
      </section>
    </div>
  );
}
