import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { securityHeaders } from "./src/lib/security-headers";

const isDev = process.env.NODE_ENV !== "production";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const imageOrigins = process.env.NEXT_PUBLIC_IMAGE_ORIGIN ? [process.env.NEXT_PUBLIC_IMAGE_ORIGIN] : [];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: imageOrigins.map((origin) => new URL(`${origin}/**`)),
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders({ isDev, siteUrl, imageOrigins }) },
      // The service worker must always be re-checked so a new deploy takes over promptly.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

// Sentry only uploads source maps when SENTRY_AUTH_TOKEN is set (CI/deploys); otherwise it is a no-op wrapper.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
