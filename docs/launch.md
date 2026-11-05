# Launch checklist

Work through this top to bottom. Items marked **(you)** need a person with the account or the
legal authority; the rest can be done by whoever deploys.

## 1. Before anything goes live

- [ ] **(you)** Legal: a Kenyan lawyer reviews the six legal drafts (`src/config/legal.ts`),
      fills the [bracketed] placeholders, and advises on holding buyer funds (CBK rules, see
      `docs/decisions.md`). Then set `LEGAL_REVIEWED = true` and update `LEGAL_UPDATED`.
- [ ] **(you)** Register with the Office of the Data Protection Commissioner and put the
      registration number in the privacy policy.
- [ ] **(you)** Decide the brand name, commission and delivery fee (Admin, Settings).
- [ ] Review the prohibited keywords (Admin, Settings) against the final prohibited items page.

## 2. Accounts and settings

- [ ] Clerk production instance: custom domain, multi-factor on (authenticator app and SMS),
      **Bot protection on** (Attack protection), webhook to `/api/webhooks/clerk`.
- [ ] Paystack live keys, M-Pesa and transfers enabled, OTP for API transfers off, webhook to
      `/api/webhooks/paystack`.
- [ ] Postgres (Neon or Supabase) on a plan with at least 7 days of point-in-time restore.
- [ ] Upstash Redis, Cloudflare R2 (public and private buckets), Meilisearch, Resend (domain
      verified), Africa's Talking (live, sender ID approved), Sentry, optional PostHog EU.
- [ ] Optional: a Cloudflare Turnstile widget for the first-message check
      (`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
- [ ] Every variable in `.env.example` set in Vercel (Production and Preview). The app refuses
      to start if one is missing or unsafe. `ENCRYPTION_KEY` stored somewhere safe too.

## 3. Staging first

- [ ] Deploy to a staging domain with Paystack **test** keys.
- [ ] Run `pnpm db:deploy`, then `pnpm search:reindex`.
- [ ] Smoke test by hand on a cheap Android phone: sign up, list an item with photos, search,
      buy with M-Pesa test, mark sent, confirm, payout, report a problem, refund, delete account.
- [ ] `pnpm load-test https://staging...` passes its budgets.
- [ ] Run the restore drill against staging (`docs/backup-restore.md`) and record the result.
- [ ] Lighthouse on home, search and a listing (mobile, slow 4G): no red scores.

## 4. Monitoring

- [ ] Uptime check on `https://<domain>/api/health` every 5 minutes, alerting by email or SMS.
- [ ] Sentry alert rules from `docs/monitoring.md`.
- [ ] Vercel cron jobs listed and running (orders, search reindex, retention).

## 5. Staff

- [ ] At least two admins (so one can't lock the other out), each with two-step verification on.
- [ ] Moderators named and trained on the queues at `/admin/moderation` and the dispute pages.
- [ ] A support email and WhatsApp number that someone answers, shown in the legal pages.

## 6. Go live

- [ ] Switch to Paystack live keys and redeploy.
- [ ] Place one real small order end to end, refund it, and check the money arrives back.
- [ ] Keep checkout's kill switch (Admin, Settings) in mind for the first week.
