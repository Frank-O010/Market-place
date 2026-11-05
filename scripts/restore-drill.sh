#!/usr/bin/env bash
# Backup restore drill: takes a logical backup of a database, restores it into a fresh scratch
# database, and checks the row counts of the key tables match. Proves backups can actually be
# restored. Usage:
#   SOURCE_URL=postgres://...  SCRATCH_ADMIN_URL=postgres://.../postgres  ./scripts/restore-drill.sh
# SCRATCH_ADMIN_URL must point at a server where we may CREATE and DROP a database. Never point
# it at production. For the managed host's point-in-time restore, see docs/backup-restore.md.
set -euo pipefail
: "${SOURCE_URL:?set SOURCE_URL}"
: "${SCRATCH_ADMIN_URL:?set SCRATCH_ADMIN_URL}"
STAMP=$(date +%Y%m%d%H%M%S)
SCRATCH_DB="restore_drill_${STAMP}"
DUMP="$(mktemp -d)/backup.dump"
TABLES=(User SellerProfile Listing "Order" Payment Payout AuditLog)

count() { psql "$1" -Atc "select count(*) from \"$2\""; }

started=$(date +%s)
echo "1/4 Backing up source database"
pg_dump --format=custom --no-owner --no-privileges "$SOURCE_URL" -f "$DUMP"
echo "    $(du -h "$DUMP" | cut -f1) written"

echo "2/4 Creating scratch database $SCRATCH_DB"
psql "$SCRATCH_ADMIN_URL" -qc "create database \"$SCRATCH_DB\""
SCRATCH_URL="${SCRATCH_ADMIN_URL%/*}/$SCRATCH_DB"
trap 'psql "$SCRATCH_ADMIN_URL" -qc "drop database if exists \"$SCRATCH_DB\"" >/dev/null; rm -f "$DUMP"' EXIT

echo "3/4 Restoring"
pg_restore --no-owner --no-privileges --exit-on-error -d "$SCRATCH_URL" "$DUMP"

echo "4/4 Comparing row counts"
ok=1
for t in "${TABLES[@]}"; do
  a=$(count "$SOURCE_URL" "$t"); b=$(count "$SCRATCH_URL" "$t")
  status=$([ "$a" = "$b" ] && echo OK || echo MISMATCH)
  [ "$status" = OK ] || ok=0
  printf "    %-14s source %-7s restored %-7s %s\n" "$t" "$a" "$b" "$status"
done
migrations=$(psql "$SCRATCH_URL" -Atc "select count(*) from _prisma_migrations where finished_at is not null")
echo "    migrations applied in restored copy: $migrations"
echo "Drill took $(( $(date +%s) - started ))s"
[ "$ok" = 1 ] && echo "RESTORE DRILL PASSED" || { echo "RESTORE DRILL FAILED"; exit 1; }
