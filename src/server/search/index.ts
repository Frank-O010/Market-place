import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { ListingSearch } from "@/lib/search-params";
import { db } from "@/server/db";
import { listingDocumentSelect, toListingDocument } from "./documents";
import { listingIndexSettings, listingsIndex, meiliClient, listingsIndexName, meiliSearch } from "./meilisearch";
import { postgresSearch } from "./postgres";

export type SearchResult = { ids: string[]; total: number; engine: "meilisearch" | "postgres" };

/** Finds ACTIVE listing ids for a search. Meilisearch first; Postgres if it's missing or failing. */
export async function searchListingIds(search: ListingSearch): Promise<SearchResult> {
  if (meiliClient()) {
    try {
      return { ...(await meiliSearch(search)), engine: "meilisearch" };
    } catch (error) {
      console.error("[search] Meilisearch failed, using Postgres", error);
      Sentry.captureException(error, { tags: { area: "search" } });
    }
  }
  return { ...(await postgresSearch(search)), engine: "postgres" };
}

/**
 * Brings one listing's search entry up to date: indexed while ACTIVE, removed otherwise.
 * Called after every listing change. Failures are logged; the daily repair job catches up.
 */
export async function syncListingToSearch(listingId: string) {
  const index = listingsIndex();
  if (!index) return;
  try {
    const listing = await db.listing.findUnique({ where: { id: listingId }, select: listingDocumentSelect });
    if (listing?.status === "ACTIVE") await index.addDocuments([toListingDocument(listing)], { primaryKey: "id" });
    else await index.deleteDocument(listingId);
  } catch (error) {
    console.error("[search] failed to sync listing", listingId, error);
    Sentry.captureException(error, { tags: { area: "search-sync" }, extra: { listingId } });
  }
}

/** Rebuilds the whole index from Postgres. Used by `pnpm search:reindex` and the daily cron. */
export async function reindexAllListings({ wait = false } = {}) {
  const client = meiliClient();
  if (!client) return { indexed: 0, skipped: "Meilisearch is not configured" as const };
  const name = listingsIndexName();
  const index = client.index(name);
  const settingsTask = index.updateSettings(listingIndexSettings);
  if (wait) await settingsTask.waitTask({ timeout: 60_000 });

  const tasks = [];
  const keep = new Set<string>();
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.listing.findMany({
      where: { status: "ACTIVE" },
      select: listingDocumentSelect,
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;
    batch.forEach((l) => keep.add(l.id));
    tasks.push(index.addDocuments(batch.map(toListingDocument), { primaryKey: "id" }));
    cursor = batch.at(-1)!.id;
  }
  // Remove anything in the index that is no longer ACTIVE.
  const stale: string[] = [];
  let offset = 0;
  for (;;) {
    let page;
    try {
      page = await index.getDocuments({ fields: ["id"], limit: 1000, offset });
    } catch {
      break; // The index is still being created on a first run, so there is nothing stale yet.
    }
    for (const doc of page.results) if (!keep.has(String(doc.id))) stale.push(String(doc.id));
    if (page.results.length < 1000) break;
    offset += 1000;
  }
  if (stale.length) tasks.push(index.deleteDocuments(stale));
  if (wait) for (const task of tasks) await task.waitTask({ timeout: 120_000 });
  return { indexed: keep.size, removed: stale.length };
}
