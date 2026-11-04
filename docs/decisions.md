# Decisions

Choices made where the build spec was open or ambiguous, newest last. Each entry says what was decided, why, and what would change it.

## Phase 1

**1. Placeholder inputs.** No niche, brand or colour was given, so the app runs as a general goods marketplace in Nairobi called "Soko", with primary colour #0F766E and a 10% commission. The brand lives in `src/config/site.ts` and the colour tokens in `src/app/globals.css`. Commission, auto-release days and the prohibited items list are rows in `PlatformSetting` and get admin UI in Phase 5.

**2. Clerk for auth, plus a local dev sign-in.** Clerk is the production provider. Development, CI and the end-to-end tests use `AUTH_PROVIDER=dev`, a cookie sign-in with seeded users and a role switcher. This lets the whole app run and be tested without Clerk keys. It is guarded three ways: env validation refuses it on Vercel and in production builds without `ALLOW_DEV_AUTH=true`, the proxy returns 404 for `/dev/*`, and every dev action re-checks that it is enabled. Roles and account status always come from our database, never from Clerk metadata. Our user record is created by the Clerk webhook, or on first request if the webhook hasn't arrived yet.

**3. Content-Security-Policy without nonces (for now).** Next.js can only add nonces to dynamically rendered pages, and that would turn off the prerendered static shell that keeps pages fast on slow phones. So `script-src` allows `'unsafe-inline'` for Next's inline bootstrap scripts. Everything else is strict: no `eval` in production, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri` and `form-action` limited to self, and allow-listed connect, frame and img origins. This should be revisited in Phase 6, either with hash-based SRI (experimental in Next) or by accepting dynamic rendering on sensitive pages such as checkout.

**4. Cache Components and Partial Prerendering are on.** Public pages prerender a static shell (header, categories, layout) and stream anything personal. Rules that follow from this:

- Anything that reads the session goes inside `<Suspense>`.
- Public catalogue reads use `"use cache"` and return only `ACTIVE` listings, so cached data can never leak a draft.
- A partially prerendered route can't change its HTTP status once streaming starts. Unknown slugs on fixed lists (such as legal pages) are therefore answered with a real 404 in `proxy.ts`. Listing and category pages in Phase 2 need the same treatment so search engines never see soft 404s.

**5. Client IP for rate limiting comes from `x-forwarded-for`.** On Vercel this header is set by the platform and can't be spoofed. If the app is ever self-hosted without a trusted proxy in front, change `clientIp()` to use the platform's verified address instead.

**6. Rate limits fall back to memory.** Without Upstash credentials, an in-memory fixed-window limiter is used. That's fine locally, but it isn't shared between serverless instances, so set Upstash on every deployed environment.

**7. System fonts.** No web font is downloaded. This saves a request and a layout shift on slow connections. A brand font can be added later through `next/font` once the brand exists.

**8. Schema is complete up front.** Every table in the spec exists from the first migration (orders, payouts, disputes, etc.) so later phases add logic, not tables. Money is stored as integers in minor units. Seller payout details are never stored in plain text: `SellerProfile.payoutReference` holds the payment provider's reference (for example a Paystack subaccount code).

**9. Images are not on the listing card yet.** Superseded in Phase 2 (see 2.2): images now carry a `status`, and only `READY` images are ever selected for public pages.

## Phase 2

**2.1 Storage and search sit behind small interfaces with local fallbacks.** Photos go to Cloudflare R2 when its variables are set, otherwise to `.data/storage` on the local disk (development and CI only; never on Vercel, where uploads are switched off with a friendly message until R2 is configured). Search uses Meilisearch when configured, otherwise Postgres (`pg_trgm` word similarity, or plain `ILIKE` if the extension isn't available). Search only returns ids; listing data always comes from Postgres filtered to `ACTIVE`, so a stale index can never show a draft or paused listing. CI runs a real Meilisearch container.

**2.2 Photo pipeline without a background worker.** The browser uploads straight to storage with a short-lived signed link (content type and exact size are part of the signature). The server then reads the bytes, checks the real type from magic bytes (JPEG, PNG, WebP; HEIC is not offered, so iPhones convert to JPEG), refuses files over 10 MB, under 300 px or over 40 megapixels, re-encodes to WebP at 200/480/1200 px with `sharp` (which drops EXIF, GPS and anything hidden in the file), and deletes the original. Pre-made sizes are served with `srcset`, so Vercel image optimisation isn't needed.

**2.3 Malware scanning is deferred to Phase 6.** Re-encoding keeps only pixels, which removes the usual way of hiding a payload in an image. A ClamAV scan needs an always-on server and arrives with the background worker. `ImageStatus.PENDING` is reserved for that flow.

**2.4 Real 404s and canonical redirects for catalogue pages.** `proxy.ts` checks `/l/…`, `/c/…` and `/s/…` before rendering: unknown or unpublished listings, categories and shops get a real 404, and a listing URL with an old slug gets a 308 to the current one. This costs one primary-key lookup per product page view (category checks are remembered for a minute).

**2.5 Publishing rules.** New listings start as drafts. Publishing needs at least one photo and something in stock. Deleting a listing that has orders marks it `REMOVED` instead.

**2.6 Search index sync.** Every listing change refreshes the cached pages (`updateTag`) and, after the response, upserts or removes the listing in Meilisearch. A daily Vercel cron (`/api/cron/search-reindex`, protected by `CRON_SECRET`) rebuilds the index to repair anything missed. `pnpm search:reindex` does the same by hand.

**2.7 Payout details move to Phase 3.** Onboarding collects shop name, address, location and bio. The M-Pesa payout number is registered with Paystack in Phase 3 so the raw number is never stored.

**2.8 Search result and filtered category pages are `noindex, follow`.** Category, listing and shop pages are indexed and listed in the sitemap. `robots.txt` blocks account, selling, admin, dev and API routes, and blocks everything on non-production Vercel deployments.

## Needs a human decision or legal review before launch

- **Holding funds (escrow).** Holding buyers' money until delivery may need a licence or a regulated partner in Kenya (CBK payment service rules). The plan is to use the payment provider's split or delayed-settlement features rather than hold money in our own account, but this needs legal review before launch.
- **Legal pages are placeholders.** These are the terms of service, seller agreement, prohibited items list, privacy policy, cookie policy, and refund and dispute policy. Each page says so on screen. All of them need to be written or reviewed by a lawyer, including Data Protection Act 2019 obligations such as ODPC registration.
- **Brand, niche and commission.** These are placeholders until decided.
