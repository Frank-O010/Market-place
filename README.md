# Soko marketplace

A two-sided marketplace where sellers in Nairobi list items and buyers find, buy and review them. It is mobile first and built for slow connections. Payment is held until the buyer confirms delivery, and buyers can pay with M-Pesa or a card. "Soko" is a placeholder brand name.

The work is split into six phases (see `docs/decisions.md` for the plan and the choices made along the way). **Phase 1 (Foundation)** is in place: database schema, sign-in with roles, the permission policy, the security baseline, the design system and the base layout.

## Tech stack

| Layer       | Choice                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------- |
| App         | Next.js 16 (App Router, Cache Components / Partial Prerendering), React 19, TypeScript strict |
| UI          | Tailwind CSS 4, Radix primitives in shadcn-style components, lucide icons                     |
| Data        | PostgreSQL, Prisma 7 (`@prisma/adapter-pg`)                                                   |
| Auth        | Clerk (email, phone OTP, Google). A local dev sign-in is used for development and tests       |
| Rate limits | Upstash Redis, with an in-memory fallback locally                                             |
| Monitoring  | Sentry                                                                                        |
| Tests       | Vitest (unit), Playwright + axe (end to end, at phone and desktop sizes)                      |

Coming in later phases: Paystack and M-Pesa Daraja payments, Meilisearch, Cloudflare R2 images, BullMQ worker, Resend, Africa's Talking and PostHog.

## Getting started

Requirements: Node 22, pnpm 10 and PostgreSQL 16.

```bash
pnpm install                 # also generates the Prisma client
cp .env.example .env         # the defaults work with a local Postgres
createdb market              # or point DATABASE_URL at any empty database
pnpm db:migrate              # apply migrations
pnpm db:seed                 # Nairobi demo data
pnpm dev                     # http://localhost:3000
```

With `AUTH_PROVIDER=dev`, go to **/dev/sign-in** to sign in as a seeded user or create a new account. Then go to **/dev/roles** to switch your own seller, moderator and admin roles. Both pages are dev-only and return 404 on a deployed site.

Seeded accounts:

| User                                                                     | Roles                         |
| ------------------------------------------------------------------------ | ----------------------------- |
| Achieng Admin                                                            | buyer, admin                  |
| Kamau Moderator                                                          | buyer, moderator              |
| Njeri Buyer, Otieno Buyer                                                | buyer                         |
| Wanjiku Mwangi, Baraka Ochieng, Amina Hassan, Kiprop Kirui, Zawadi Mutua | buyer, seller (one shop each) |
| Suspended User                                                           | suspended seller              |

The design system gallery is at **/dev/components**.

## Scripts

| Command                                              | What it does                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `pnpm dev`                                           | Start the dev server                                                                  |
| `pnpm build` / `pnpm start`                          | Production build and server                                                           |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | Static checks (CI runs all three)                                                     |
| `pnpm test`                                          | Unit tests                                                                            |
| `pnpm test:e2e`                                      | End-to-end tests. Build first with `AUTH_PROVIDER=dev ALLOW_DEV_AUTH=true pnpm build` |
| `pnpm db:migrate`                                    | Create and apply a migration after changing `prisma/schema.prisma`                    |
| `pnpm db:deploy`                                     | Apply migrations (CI and deploys)                                                     |
| `pnpm db:seed` / `pnpm db:reset`                     | Reseed demo data / drop, migrate and reseed                                           |

## Environment variables

All of them are documented in [`.env.example`](.env.example) and validated at startup by `src/lib/env.ts`. A missing or invalid value stops the app with a clear message. The important rule is that a deployed site must use `AUTH_PROVIDER=clerk`. The app refuses to start with dev sign-in on Vercel, and in any production build unless `ALLOW_DEV_AUTH=true` is set (only the e2e tests do that).

Accounts you'll need before deploying: Clerk, a managed Postgres (Neon or Supabase), Upstash Redis, Sentry, and Vercel. Payments, search and image storage accounts come with Phases 2 and 3.

## Architecture

```mermaid
flowchart LR
  Browser -->|HTTPS| CF[Cloudflare DNS, TLS, WAF]
  CF --> Vercel[Next.js on Vercel]
  Vercel --> Proxy[proxy.ts: Clerk session, dev-tools guard]
  Proxy --> RSC[Server components and server actions]
  RSC --> Policy[Policy module: can user, action, resource]
  RSC --> DB[(PostgreSQL via Prisma)]
  RSC --> RL[(Upstash Redis rate limits)]
  Clerk[Clerk] -->|signed webhook| Vercel
  Vercel --> Sentry[Sentry]
```

```
prisma/                schema, migrations, seed
src/app/               routes: (public), (auth), (account), (seller), (admin), dev/, api/webhooks
src/components/ui/     design-system components
src/components/        feature components (header, listing card, …)
src/server/auth/       identity (Clerk or dev), current user, Clerk sync
src/server/policy/     can() and its tests — every permission decision lives here
src/server/queries/    cached public reads (active listings only)
src/server/actions/    server actions
src/lib/               env validation, money (integer KES), security headers, utils
tests/e2e/             Playwright tests
docs/                  decisions, security checklist
```

### How permissions work

The auth provider only tells us who someone is. What they may do comes from our own database, through `src/server/policy/can.ts`. Every page, server action and route handler loads the resource and then calls `can()` or `assertCan()` with it. The proxy never makes access decisions, so a missed route matcher can't open a hole. Suspended users are denied everything.

### Money

All amounts are integers in minor units (KES cents). Use the helpers in `src/lib/money.ts` and never use floats.
