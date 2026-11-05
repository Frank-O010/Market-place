import { z } from "zod";
import { nairobiAreas } from "@/config/locations";
import { listingConditions, type ListingConditionValue } from "@/lib/listings/schema";

/** Search and browse filters, parsed leniently from the URL: bad values are dropped, never errors. */

export const sortOptions = {
  relevance: "Best match",
  newest: "Newest first",
  price_asc: "Lowest price",
  price_desc: "Highest price",
} as const;
export type SortOption = keyof typeof sortOptions;

export const PER_PAGE = 24;
const MAX_PAGE = 50;

export type ListingSearch = {
  q: string;
  category?: string;
  minPrice?: number; // minor units
  maxPrice?: number; // minor units
  conditions: ListingConditionValue[];
  location?: string;
  sort: SortOption;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const all = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value : value ? value.split(",") : []).slice(0, 10);

const shillings = z.coerce.number().int().min(0).max(10_000_000);
const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

export function parseListingSearch(raw: RawParams, fixed: { category?: string } = {}): ListingSearch {
  const q = (first(raw.q) ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  const min = shillings.safeParse(first(raw.min));
  const max = shillings.safeParse(first(raw.max));
  const category = slug.safeParse(fixed.category ?? first(raw.category));
  const location = first(raw.location);
  const sort = first(raw.sort);
  const page = z.coerce.number().int().min(1).max(MAX_PAGE).safeParse(first(raw.page));
  const defaultSort: SortOption = q ? "relevance" : "newest";
  let minPrice = min.success && first(raw.min) !== "" ? min.data * 100 : undefined;
  let maxPrice = max.success && first(raw.max) !== "" ? max.data * 100 : undefined;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  return {
    q,
    category: category.success ? category.data : undefined,
    minPrice,
    maxPrice,
    conditions: [...new Set(all(raw.condition))].filter((c): c is ListingConditionValue =>
      (listingConditions as readonly string[]).includes(c),
    ),
    location: location && (nairobiAreas as readonly string[]).includes(location) ? location : undefined,
    sort: sort && sort in sortOptions && !(sort === "relevance" && !q) ? (sort as SortOption) : defaultSort,
    page: page.success ? page.data : 1,
  };
}

/** Builds a URL for the same search with some values changed. Resets to page 1 unless a page is given. */
export function searchHref(base: string, search: ListingSearch, changes: Partial<ListingSearch> = {}): string {
  const next = { ...search, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category && base === "/search") params.set("category", next.category);
  if (next.minPrice !== undefined) params.set("min", String(next.minPrice / 100));
  if (next.maxPrice !== undefined) params.set("max", String(next.maxPrice / 100));
  if (next.conditions.length) params.set("condition", next.conditions.join(","));
  if (next.location) params.set("location", next.location);
  if (next.sort !== (next.q ? "relevance" : "newest")) params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function hasFilters(search: ListingSearch) {
  return Boolean(
    search.minPrice !== undefined || search.maxPrice !== undefined || search.conditions.length || search.location,
  );
}
