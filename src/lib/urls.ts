/** Canonical public URLs. Keep every link to these pages going through here. */

export const listingPath = (listing: { slug: string; id: string }) => `/l/${listing.slug || "item"}-${listing.id}`;
export const categoryPath = (slug: string) => `/c/${slug}`;
export const sellerPath = (slug: string) => `/s/${slug}`;

/** "/l/samsung-galaxy-a54-clx123..." -> { slug: "samsung-galaxy-a54", id: "clx123..." } */
export function parseListingParam(param: string): { slug: string; id: string } | null {
  const match = /^(?:([a-z0-9-]*)-)?([a-z0-9]{20,40})$/.exec(param);
  if (!match) return null;
  return { slug: match[1] ?? "", id: match[2]! };
}

export function absoluteUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
