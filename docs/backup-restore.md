# Backups and restoring

The database is the only thing we can't rebuild. Photos live in R2 (Cloudflare keeps them
durably), the search index can be rebuilt with `pnpm search:reindex`, and the code is in Git.

## What protects the data

- **Point-in-time restore (PITR)** from the managed Postgres host. Neon keeps a history you can
  branch from (7 days on Launch, 30 on Scale); Supabase offers PITR as an add-on on Pro (daily
  backups are included). Pick a plan with at least 7 days before launch.
- **A weekly logical backup** you control, as a second copy: `pg_dump --format=custom` into a
  private, versioned bucket (for example the private R2 bucket under `backups/`). It protects
  against losing access to the database account itself.

## Restoring after a mistake (bad migration, wrong bulk update)

1. Switch checkout off in Admin, Settings so no new payments come in while you work.
2. Find the time just before the mistake (Admin, Audit log, or Sentry).
3. **Neon:** Branches, Create branch, "Past point in time", pick that time. **Supabase:**
   Database, Backups, Point in time, pick that time (this restores in place, so take a
   `pg_dump` of the current state first).
4. Neon: check the new branch (row counts, the last few orders), then either point
   `DATABASE_URL` in Vercel at it and redeploy, or copy the damaged rows back from it.
5. Compare paid orders against the Paystack dashboard for the gap, and fix any payment that
   arrived after the restore point (the Paystack webhook can be replayed from its dashboard).
6. Switch checkout back on and write down what happened and when.

## Restore drill (do it before launch, then every 3 months)

`scripts/restore-drill.sh` takes a backup, restores it into a new scratch database, compares row
counts for the key tables, and drops the scratch database again.

```bash
SOURCE_URL="postgres://...staging..." \
SCRATCH_ADMIN_URL="postgres://...a server where you may create databases.../postgres" \
./scripts/restore-drill.sh
```

Never point `SCRATCH_ADMIN_URL` at production. On Neon, the simplest scratch server is a
separate branch. Write down how long the restore took: that's your real recovery time.

| Date            | Where           | Rows checked                                                                       | Result | Time |
| --------------- | --------------- | ---------------------------------------------------------------------------------- | ------ | ---- |
| 5 November 2026 | Local test data | User 25, SellerProfile 8, Listing 42, Order 35, Payment 23, Payout 8, AuditLog 147 | Passed | 1 s  |

Next: run it against staging once it exists, and add the result here.
