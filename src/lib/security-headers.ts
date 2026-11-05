/**
 * Security headers applied to every response (see next.config.ts).
 *
 * Content-Security-Policy note: Next.js can only add nonces to dynamically rendered pages,
 * and nonces disable the static shell that keeps pages fast on slow connections. So for now
 * script-src allows 'unsafe-inline' for Next's inline bootstrap scripts, while everything else
 * is locked down. Revisit in Phase 6 (hash-based SRI or nonces). Recorded in docs/decisions.md.
 */

type CspOptions = {
  isDev: boolean;
  siteUrl: string;
  /** Extra image origins, e.g. the R2 public bucket or image CDN. */
  imageOrigins?: string[];
};

export function buildCsp({ isDev, siteUrl, imageOrigins = [] }: CspOptions): string {
  const siteHost = new URL(siteUrl).hostname;
  const clerk = ["https://*.clerk.accounts.dev", `https://clerk.${siteHost}`];
  const turnstile = "https://challenges.cloudflare.com";
  const sentry = ["https://*.ingest.sentry.io", "https://*.ingest.de.sentry.io", "https://*.ingest.us.sentry.io"];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), ...clerk, turnstile],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://img.clerk.com", ...imageOrigins],
    "font-src": ["'self'"],
    // Listing photos upload straight from the browser to Cloudflare R2 with a signed link.
    "connect-src": ["'self'", ...clerk, ...sentry, "https://*.r2.cloudflarestorage.com", ...(isDev ? ["ws:"] : [])],
    "frame-src": [turnstile, ...clerk],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(options: CspOptions): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: buildCsp(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      // Camera stays available to our own pages for listing photos in Phase 2.
      value: "camera=(self), microphone=(), geolocation=(self), payment=(self), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
  if (!options.isDev) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
  }
  return headers;
}
