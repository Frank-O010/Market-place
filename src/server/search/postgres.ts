import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { PER_PAGE, type ListingSearch } from "@/lib/search-params";
import { db } from "@/server/db";

/**
 * Search straight from Postgres. Used when Meilisearch isn't configured or is unreachable.
 * With pg_trgm it tolerates typos ("samsng" finds "Samsung"); without it, it matches substrings.
 */

let trigramAvailable: boolean | undefined;

async function hasTrigram(): Promise<boolean> {
  if (trigramAvailable !== undefined) return trigramAvailable;
  const rows = await db.$queryRaw<{ ok: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS ok`;
  trigramAvailable = Boolean(rows[0]?.ok);
  return trigramAvailable;
}

export async function postgresSearch(search: ListingSearch): Promise<{ ids: string[]; total: number }> {
  const where: Prisma.Sql[] = [Prisma.sql`l."status" = 'ACTIVE'`];

  if (search.category) {
    where.push(Prisma.sql`(c."slug" = ${search.category} OR p."slug" = ${search.category})`);
  }
  if (search.minPrice !== undefined) where.push(Prisma.sql`l."priceMinor" >= ${search.minPrice}`);
  if (search.maxPrice !== undefined) where.push(Prisma.sql`l."priceMinor" <= ${search.maxPrice}`);
  if (search.conditions.length) {
    where.push(Prisma.sql`l."condition"::text IN (${Prisma.join(search.conditions)})`);
  }
  if (search.location) where.push(Prisma.sql`l."location" = ${search.location}`);

  const trigram = search.q ? await hasTrigram() : false;
  let score = Prisma.sql`0`;
  if (search.q) {
    const like = `%${search.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    const words = search.q.toLowerCase().split(" ").filter(Boolean).slice(0, 8);
    if (trigram) {
      // Every word must loosely match somewhere in the title, category or description start.
      const haystack = Prisma.sql`lower(l."title" || ' ' || c."name" || ' ' || left(l."description", 300))`;
      for (const word of words) {
        where.push(Prisma.sql`(${haystack} LIKE ${`%${word.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`} OR word_similarity(${word}, ${haystack}) >= 0.5)`);
      }
      score = Prisma.sql`word_similarity(${search.q.toLowerCase()}, lower(l."title"))`;
    } else {
      where.push(Prisma.sql`(l."title" ILIKE ${like} OR c."name" ILIKE ${like} OR l."description" ILIKE ${like})`);
      score = Prisma.sql`CASE WHEN l."title" ILIKE ${like} THEN 1 ELSE 0 END`;
    }
  }

  const orderBy = {
    relevance: Prisma.sql`score DESC, l."publishedAt" DESC NULLS LAST`,
    newest: Prisma.sql`l."publishedAt" DESC NULLS LAST, l."id"`,
    price_asc: Prisma.sql`l."priceMinor" ASC, l."id"`,
    price_desc: Prisma.sql`l."priceMinor" DESC, l."id"`,
  }[search.sort];

  const from = Prisma.sql`
    FROM "Listing" l
    JOIN "Category" c ON c."id" = l."categoryId"
    LEFT JOIN "Category" p ON p."id" = c."parentId"
    WHERE ${Prisma.join(where, " AND ")}`;

  const [rows, count] = await Promise.all([
    db.$queryRaw<{ id: string }[]>`
      SELECT l."id", ${score} AS score ${from}
      ORDER BY ${orderBy}
      LIMIT ${PER_PAGE} OFFSET ${(search.page - 1) * PER_PAGE}`,
    db.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total ${from}`,
  ]);
  return { ids: rows.map((r) => r.id), total: Number(count[0]?.total ?? 0) };
}
