import type { MetadataRoute } from "next";
import { legalPages } from "@/config/site";
import { absoluteUrl, categoryPath, listingPath, sellerPath } from "@/lib/urls";
import { getSitemapEntries } from "@/server/queries/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { categories, listings, sellers } = await getSitemapEntries();
  return [
    { url: absoluteUrl("/"), changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/help"), changeFrequency: "monthly", priority: 0.3 },
    ...legalPages.map((page) => ({
      url: absoluteUrl(`/legal/${page.slug}`),
      changeFrequency: "yearly" as const,
      priority: 0.1,
    })),
    ...categories.map((c) => ({
      url: absoluteUrl(categoryPath(c.slug)),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...listings.map((l) => ({ url: absoluteUrl(listingPath(l)), lastModified: l.updatedAt, priority: 0.6 })),
    ...sellers.map((s) => ({ url: absoluteUrl(sellerPath(s.slug)), lastModified: s.updatedAt, priority: 0.4 })),
  ];
}
