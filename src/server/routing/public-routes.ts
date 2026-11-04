import "server-only";
import { listingPath, parseListingParam } from "@/lib/urls";
import { db } from "@/server/db";

/**
 * Decides, before rendering starts, whether a catalogue URL exists. Pages stream (partial
 * prerendering), so they can't change the status code once they start; answering here means
 * search engines get a real 404 for missing pages and a permanent redirect to the canonical URL.
 */
export type RouteCheck = { kind: "ok" } | { kind: "missing" } | { kind: "redirect"; to: string };

// Categories rarely change, so their checks are remembered briefly. Listings and sellers are
// checked every time (a primary-key lookup), so a newly published listing is never a 404.
const TTL_MS = 60_000;
const memo = new Map<string, { value: RouteCheck; expires: number }>();

async function remember(key: string, load: () => Promise<RouteCheck>): Promise<RouteCheck> {
  const hit = memo.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load();
  if (memo.size > 5000) memo.clear();
  memo.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

export async function checkPublicRoute(pathname: string): Promise<RouteCheck | null> {
  const listing = /^\/l\/([^/]+)\/?$/.exec(pathname);
  if (listing) {
    const parsed = parseListingParam(listing[1]!);
    if (!parsed) return { kind: "missing" };
    const row = await db.listing.findUnique({ where: { id: parsed.id }, select: { slug: true, status: true } });
    if (!row || (row.status !== "ACTIVE" && row.status !== "SOLD")) return { kind: "missing" };
    if (row.slug !== parsed.slug) return { kind: "redirect", to: listingPath({ slug: row.slug, id: parsed.id }) };
    return { kind: "ok" };
  }
  const category = /^\/c\/([^/]+)\/?$/.exec(pathname);
  if (category) {
    const slug = category[1]!;
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { kind: "missing" };
    return remember(`c:${slug}`, async () =>
      (await db.category.count({ where: { slug } })) ? { kind: "ok" } : { kind: "missing" },
    );
  }
  const seller = /^\/s\/([^/]+)\/?$/.exec(pathname);
  if (seller) {
    const slug = seller[1]!;
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { kind: "missing" };
    const found = await db.sellerProfile.count({ where: { slug, user: { status: "ACTIVE" } } });
    return found ? { kind: "ok" } : { kind: "missing" };
  }
  return null;
}
