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

## Phase 3

**3.1 Paystack for card and M-Pesa.** One provider handles card payments (hosted checkout), M-Pesa STK push (the `/charge` mobile money API), refunds and seller payouts (transfers to M-Pesa numbers). Going straight to Safaricom Daraja would mean a second integration, our own paybill and settlement work; Paystack Kenya already settles M-Pesa. The gateway sits behind an interface (`src/server/payments`), so Daraja can be added later without touching orders.

**3.2 Webhooks are the source of truth.** An order becomes paid only when a Paystack webhook with a valid HMAC-SHA512 signature arrives, and the charge is then confirmed again with Paystack's verify API before any money state changes. The browser redirect after card payment only shows a "checking your payment" page. Every handler is idempotent and safe out of order: payments are claimed with a conditional update on their unique reference, and order transitions use optimistic locking, so duplicate or concurrent events do nothing. Unknown references, amount or currency mismatches and late payments are written to the audit log (and Sentry for mismatches).

**3.3 One order per seller.** The cart groups items by seller and each group checks out separately. Payment, delivery, cancellation and payouts then each involve exactly one seller.

**3.4 Sign-in is required to check out.** No guest checkout: buyers need an account to track orders, confirm delivery and (in Phase 4) open disputes. Card payments also need an email; M-Pesa-only buyers can pay without one.

**3.5 Stock is reserved when the order is placed.** Stock is decremented atomically at checkout (the update only succeeds if enough is left), so two buyers can't buy the last item. The buyer has 30 minutes to pay; after that the order is cancelled and the stock returned. A payment that lands after cancellation is refunded automatically and the buyer is emailed.

**3.6 Money is released on delivery, not on payment.** Order flow: placed → paid → shipped → delivered → completed. The buyer confirms delivery, or it is confirmed automatically `auto_release_days` (setting, default 3) after shipping. Completion creates the seller's payout of total minus commission. Commission (`commission_bps`, default 10%) applies to items only; the delivery fee (`delivery_fee_minor`, default KES 300) goes to the seller. A seller can cancel before shipping, which refunds the buyer in full.

**3.7 Payouts go to M-Pesa through Paystack transfers.** The seller enters their M-Pesa number once; it is registered with Paystack as a transfer recipient and only the recipient code and a masked label (for example "M-Pesa ••• 678") are stored. Payouts wait if the seller hasn't added details yet and are retried by the daily job. **Transfers must be enabled on the Paystack account** (and OTP for transfers turned off for API use), otherwise payouts stay pending.

**3.8 Daily jobs, plus clean-up at checkout.** Vercel's Hobby plan only allows daily cron jobs, so `/api/cron/orders` runs once a day (expire unpaid orders, auto-release, retry payouts). Expiry also runs at the start of every checkout, so stock held by abandoned orders is freed when someone needs it. On a Pro plan the cron can run every 10 minutes by changing `vercel.json`.

**3.9 Emails through Resend with an outbox.** Every email (order placed, paid, shipped, completed, cancelled, refunded, payout sent) is stored in `EmailMessage` first and then sent. A failed send never breaks the order flow. Without `RESEND_API_KEY`, emails are only stored and can be read at `/dev/outbox` locally.

**3.10 Mock gateway for development and CI.** Without `PAYSTACK_SECRET_KEY`, local development and CI use a mock gateway with a sandbox page (`/dev/payments/…`) that sends a correctly signed webhook, so the full flow is tested end to end. On a deployed site without the key, checkout shows "Checkout isn't switched on yet" rather than using the mock.

## Phase 4

**4.1 Messaging is polling, not websockets.** Conversations are per buyer, seller and listing. An open conversation checks for new messages every 5 seconds while the tab is visible. That is cheap on Vercel and fine at launch volume; a realtime service (Pusher, Ably or Supabase Realtime) can replace it later without changing the data model.

**4.2 Contact details: warn, mark, never strip.** Before the buyer has paid for an order from that seller, a message containing a phone number (including spaced-out or spelled-out digits), an email address or "WhatsApp" shows the sender a warning that the deal won't be protected. They can edit it or send anyway. Sent anyway, the message is marked and the other person sees a safety note. We never silently change what someone wrote.

**4.3 Notifications: in-app always, email and SMS by preference.** Every event creates an in-app notification (the bell). New messages also email the recipient (at most once per conversation per 15 minutes; can be turned off). SMS through Africa's Talking goes out for the two moments that need action: a seller's new paid order and a buyer's order on the way (can be turned off). Receipts and dispute emails always go. Without Africa's Talking keys, SMS are recorded but not sent.

**4.4 Reviews.** One review per completed order, from the buyer only, rating 1 to 5 with optional text. The seller can reply once, publicly. The seller's rating is recalculated from visible reviews; moderators can hide a review, which removes it from the rating. Buyers are shown by first name with "verified purchase". The seed's made-up rating numbers were replaced with real demo orders and reviews.

**4.5 What goes to the moderation queue.** A new seller's first listing (unless they're ID-verified), any listing that mentions a word on the prohibited-keywords list (`prohibited_keywords` setting: weapons, drugs, counterfeits, wildlife products, alcohol and so on), and any live listing reported by 3 different people (it is taken down until checked). A keyword match doesn't block the seller, because too many innocent listings contain those words ("glue gun"); a moderator decides. Moderators can approve, send back with a reason, or remove.

**4.6 Disputes.** The buyer can report a problem while the money is held (paid, on the way, or delivered), with up to 3 photos. That stops automatic release. The seller can reply once or refund in full; the buyer can withdraw ("problem sorted", which releases the money). A moderator decides the rest: full refund, partial refund, or release. **A partial refund comes out of the seller's share and the platform keeps its full commission**; the maximum partial refund is the seller's share. Disputes can also be opened before shipping ("never sent").

**4.7 ID verification.** Sellers upload a photo of their national ID or passport. It is re-encoded (dropping EXIF and GPS) and stored in a private R2 bucket with no public access. The database keeps only its key, encrypted with AES-256-GCM (`ENCRYPTION_KEY`). Only moderators can view it, through an authorised route, never a public URL. Moderators approve as "Verified" (ID) or "Verified business", or reject with a reason, which deletes the photo at once. Approved photos are kept; **how long to keep them is a legal question** (see below). "Phone verified" is automatic once the seller's phone is confirmed through Clerk. Verified sellers skip the first-listing check.

**4.8 Fraud flags hold the payout, not the order.** When an order is paid we check three signals: a new account (under 7 days) ordering KES 20,000 or more; 3 or more failed payments on other unpaid orders in the last day; and the payment phone number used by 3 or more accounts in 30 days. A flagged order goes ahead for the buyer, but the seller's payout waits until a moderator clears it (or refunds the order if it hasn't been sent). Device fingerprinting was left out: it needs a third-party script and a privacy review.

**4.9 Deferred to later phases.** Turnstile (bot check) on the first message goes with the other Turnstile work in Phase 6. 2FA for moderators and admins is enforced in Phase 5. The full admin panel (users, roles, settings, audit log search) is Phase 5; Phase 4 adds the moderation queues at `/admin/moderation` and dispute pages at `/admin/disputes/…`.

## Needs a human decision or legal review before launch

- **Holding funds (escrow).** Holding buyers' money until delivery may need a licence or a regulated partner in Kenya (CBK payment service rules). As built in Phase 3, buyer payments settle into the platform's Paystack balance and are paid out to sellers by transfer after delivery, which is effectively holding funds. Before going live, get legal advice on whether this needs CBK authorisation, or switch to Paystack split payments/subaccounts (the gateway interface allows this).
- **Legal pages are placeholders.** These are the terms of service, seller agreement, prohibited items list, privacy policy, cookie policy, and refund and dispute policy. Each page says so on screen. All of them need to be written or reviewed by a lawyer, including Data Protection Act 2019 obligations such as ODPC registration.
- **Brand, niche and commission.** These are placeholders until decided.
- **ID documents.** How long to keep approved ID photos, and whether ID checks need a registered data processor, under the Data Protection Act 2019. The current build keeps approved photos and deletes rejected ones immediately.
- **Prohibited keywords and categories.** The starting list is a guess; it should match the final prohibited items policy.
