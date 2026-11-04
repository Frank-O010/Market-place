/**
 * Rebuilds the Meilisearch listings index from Postgres and applies the index settings.
 * Usage: pnpm search:reindex   (needs MEILISEARCH_HOST and MEILISEARCH_ADMIN_KEY)
 */
import "dotenv/config";
import { reindexAllListings } from "@/server/search";
import { db } from "@/server/db";

const result = await reindexAllListings({ wait: true });
console.log("[search:reindex]", result);
await db.$disconnect();
