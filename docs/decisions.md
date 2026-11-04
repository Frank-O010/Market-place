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

**9. Images are not on the listing card yet.** The card shows a category placeholder until the Phase 2 image pipeline (signed R2 upload, re-encode, EXIF strip, malware scan). Only images with `scanned = true` are ever selected for public pages.

## Needs a human decision or legal review before launch

- **Holding funds (escrow).** Holding buyers' money until delivery may need a licence or a regulated partner in Kenya (CBK payment service rules). The plan is to use the payment provider's split or delayed-settlement features rather than hold money in our own account, but this needs legal review before launch.
- **Legal pages are placeholders.** These are the terms of service, seller agreement, prohibited items list, privacy policy, cookie policy, and refund and dispute policy. Each page says so on screen. All of them need to be written or reviewed by a lawyer, including Data Protection Act 2019 obligations such as ODPC registration.
- **Brand, niche and commission.** These are placeholders until decided.
