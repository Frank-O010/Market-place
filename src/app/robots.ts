import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/urls";

export default function robots(): MetadataRoute.Robots {
  // Only the production site should be indexed; previews and staging stay out of search results.
  const indexable = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : true;
  return {
    rules: indexable
      ? [
          {
            userAgent: "*",
            allow: "/",
            disallow: [
              "/account",
              "/sell",
              "/admin",
              "/dev",
              "/api/",
              "/search",
              "/sign-in",
              "/sign-up",
              "/messages",
              "/notifications",
            ],
          },
        ]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
