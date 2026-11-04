import type { ListingSearch } from "@/lib/search-params";

/** Quotes a value for a Meilisearch filter expression. */
export const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export function meiliFilter(search: ListingSearch): string[] {
  const filter: string[] = [];
  if (search.category) filter.push(`categorySlugs = ${quote(search.category)}`);
  if (search.minPrice !== undefined) filter.push(`priceMinor >= ${Math.trunc(search.minPrice)}`);
  if (search.maxPrice !== undefined) filter.push(`priceMinor <= ${Math.trunc(search.maxPrice)}`);
  if (search.conditions.length) filter.push(`condition IN [${search.conditions.map(quote).join(", ")}]`);
  if (search.location) filter.push(`location = ${quote(search.location)}`);
  return filter;
}

export function meiliSort(search: ListingSearch): string[] | undefined {
  switch (search.sort) {
    case "newest":
      return ["publishedAt:desc"];
    case "price_asc":
      return ["priceMinor:asc"];
    case "price_desc":
      return ["priceMinor:desc"];
    default:
      // Best match, with newer listings first among equals.
      return search.q ? undefined : ["publishedAt:desc"];
  }
}
