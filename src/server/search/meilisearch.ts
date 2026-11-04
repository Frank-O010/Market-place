import "server-only";
import { Meilisearch, type Index } from "meilisearch";
import { env } from "@/lib/env";
import { PER_PAGE, type ListingSearch } from "@/lib/search-params";
import type { ListingDocument } from "./documents";
import { meiliFilter, meiliSort } from "./meili-filter";

let client: Meilisearch | null | undefined;

export function meiliClient(): Meilisearch | null {
  if (client !== undefined) return client;
  const { MEILISEARCH_HOST: host, MEILISEARCH_ADMIN_KEY: apiKey } = env();
  // Short timeouts: if search is slow we'd rather fall back to Postgres than keep a buyer waiting.
  client = host && apiKey ? new Meilisearch({ host, apiKey, timeout: 3000 }) : null;
  return client;
}

export const listingsIndexName = () => `${env().MEILISEARCH_INDEX_PREFIX}listings`;

export function listingsIndex(): Index<ListingDocument> | null {
  return meiliClient()?.index<ListingDocument>(listingsIndexName()) ?? null;
}

/** Index settings. Applied by `pnpm search:reindex` and the daily repair job. */
export const listingIndexSettings = {
  searchableAttributes: ["title", "details", "categoryName", "sellerName", "description"],
  filterableAttributes: ["categorySlugs", "priceMinor", "condition", "location"],
  sortableAttributes: ["priceMinor", "publishedAt"],
  displayedAttributes: ["id"],
  rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness", "publishedAt:desc"],
  typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
  pagination: { maxTotalHits: 2000 },
};

export async function meiliSearch(search: ListingSearch): Promise<{ ids: string[]; total: number }> {
  const index = listingsIndex();
  if (!index) throw new Error("Meilisearch is not configured");
  const result = await index.search(search.q, {
    filter: meiliFilter(search),
    sort: meiliSort(search),
    hitsPerPage: PER_PAGE,
    page: search.page,
    attributesToRetrieve: ["id"],
  });
  return { ids: result.hits.map((hit) => hit.id), total: result.totalHits ?? result.hits.length };
}
