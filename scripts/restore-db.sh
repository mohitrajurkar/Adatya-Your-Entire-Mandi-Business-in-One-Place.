#!/bin/bash
# ============================================================================
# Adatya PostgreSQL restore
#
# Usage: ./scripts/restore-db.sh <path-to-backup.sql.gz>
#
# WHAT CHANGED, AND WHY
#
# The previous version ran DROP DATABASE on the live database after a single
# y/N prompt. If the dump turned out to be truncated, from the wrong
# environment, or simply the wrong file, the business ledger was already gone
# and there was nothing to go back to.
#
# This version never drops anything:
#
#   1. Checks the backup file is readable and is a valid gzip archive.
#   2. Dumps the CURRENT database first, so the restore is reversible.
#   3. Loads the backup into a NEW staging database, leaving the live one
#      serving traffic untouched.
#   4. Verifies the staging database actually contains the expected tables
#      and reports its row counts, so you see what you are about to switch to.
#   5. Asks you to type the database name to confirm the switch.
#   6. Switches by RENAMING: the live database is kept under a dated name,
#      and the staging database takes its place. Nothing is destroyed, so
#      rolling back is two more renames.
#
# Superseded databases are left on disk on purpose. Remove them yourself once
# you are satisfied, with: DROP DATABASE adatya_db_superseded_<timestamp>;
# ============================================================================

set -euo pipefail

DB_NAME="${POSTGRES_DB:-adatya_db}"
DB_USER="${POSTGRES_USER:-${DB_USERNAME:-postgres}}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_CONTAINER="${ADATYA_DB_CONTAINER:-adatya-database}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

STAGING_DB="${DB_NAME}_restore_${TIMESTAMP}"
SUPERSEDED_DB="${DB_NAME}_superseded_${TIMESTAMP}"

# ---------------------------------------------------------------------------
# Decide how to reach PostgreSQL: a local client if present, otherwise the
# Docker container, which is how Adatya normally runs.
# ---------------------------------------------------------------------------
if command -v psql >/dev/null 2>&1; then
    MODE="native"
    psql_do()    { psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"; }
    pgdump_do()  { pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"; }
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    MODE="docker ($DB_CONTAINER)"
    psql_do()    { docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" "$@"; }
    pgdump_do()  { docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$@"; }
else
    echo "ERROR: no psql on PATH and the '$DB_CONTAINER' container is not running." >&2
    echo "       Start the stack, or install the PostgreSQL client tools." >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# 1. Validate the input before touching anything
# ---------------------------------------------------------------------------
if [ $# -lt 1 ]; then
    echo "Usage: ./scripts/restore-db.sh <path-to-backup.sql.gz>" >&2
    echo "Example: ./scripts/restore-db.sh ./backups/adatya_db_backup_20261019_120000.sql.gz" >&2
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: backup file '$BACKUP_FILE' not found." >&2
    exit 1
fi

if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo "ERROR: '$BACKUP_FILE' is not a readable gzip archive. Refusing to continue." >&2
    exit 1
fi

TABLE_COUNT="$(zcat "$BACKUP_FILE" | grep -c '^CREATE TABLE' || true)"
if [ "$TABLE_COUNT" -lt 1 ]; then
    echo "ERROR: '$BACKUP_FILE' contains no CREATE TABLE statements." >&2
    echo "       This does not look like an Adatya schema dump. Refusing to continue." >&2
    exit 1
fi

echo "Connection mode : $MODE"
echo "Live database   : $DB_NAME"
echo "Backup file     : $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1), $TABLE_COUNT tables)"
echo

if ! psql_do -d "$DB_NAME" -tAc 'SELECT 1' >/dev/null 2>&1; then
    echo "ERROR: cannot connect to database '$DB_NAME'." >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# 2. Dump what is there now, so this is reversible
# ---------------------------------------------------------------------------
mkdir -p "$BACKUP_DIR"
SAFETY_DUMP="${BACKUP_DIR}/pre_restore_${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "Step 1/5  Dumping the current database before any change..."
pgdump_do -d "$DB_NAME" | gzip > "$SAFETY_DUMP"
if ! gzip -t "$SAFETY_DUMP" 2>/dev/null; then
    echo "ERROR: the safety dump failed verification. Aborting without changing anything." >&2
    rm -f "$SAFETY_DUMP"
    exit 1
fi
echo "          Saved $SAFETY_DUMP ($(du -h "$SAFETY_DUMP" | cut -f1))"

# ---------------------------------------------------------------------------
# 3. Load the backup into a staging database. The live one keeps serving.
# ---------------------------------------------------------------------------
echo "Step 2/5  Loading the backup into staging database '$STAGING_DB'..."
psql_do -d postgres -q -c "CREATE DATABASE \"$STAGING_DB\";"

if ! zcat "$BACKUP_FILE" | psql_do -d "$STAGING_DB" -q -v ON_ERROR_STOP=1 >/dev/null; then
    echo "ERROR: the backup failed to load. The live database has NOT been touched." >&2
    psql_do -d postgres -q -c "DROP DATABASE IF EXISTS \"$STAGING_DB\";" || true
    exit 1
fi

# ---------------------------------------------------------------------------
# 4. Show what the staging database actually contains
# ---------------------------------------------------------------------------
echo "Step 3/5  Verifying the restored data..."
STAGED_TABLES="$(psql_do -d "$STAGING_DB" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
if [ "$STAGED_TABLES" -lt 1 ]; then
    echo "ERROR: the staging database has no tables. Aborting; live database untouched." >&2
    psql_do -d postgres -q -c "DROP DATABASE IF EXISTS \"$STAGING_DB\";" || true
    exit 1
fi

echo
echo "          Row counts: live  ->  restored"
for tbl in users business_profile farmers commodities purchases purchase_items payments mandi_sales stock_adjustments; do
    live="$(psql_do -d "$DB_NAME"    -tAc "SELECT count(*) FROM $tbl;" 2>/dev/null || echo '-')"
    new="$( psql_do -d "$STAGING_DB" -tAc "SELECT count(*) FROM $tbl;" 2>/dev/null || echo '-')"
    printf '            %-20s %8s  ->  %8s\n' "$tbl" "$live" "$new"
done
echo

# ---------------------------------------------------------------------------
# 5. Confirm, then switch by renaming. Nothing is dropped.
# ---------------------------------------------------------------------------
cat <<EOF
          The restored data above will REPLACE what the application serves.
          The current database will be kept as: $SUPERSEDED_DB
          A dump of it is also at:              $SAFETY_DUMP

EOF

CONFIRM="${ADATYA_RESTORE_CONFIRM:-}"
if [ -z "$CONFIRM" ]; then
    printf "          Type the database name (%s) to proceed, anything else to cancel: " "$DB_NAME"
    read -r CONFIRM
fi

if [ "$CONFIRM" != "$DB_NAME" ]; then
    echo
    echo "Cancelled. Nothing was changed."
    echo "The staging copy is left at '$STAGING_DB' for inspection; remove it with:"
    echo "  DROP DATABASE \"$STAGING_DB\";"
    exit 0
fi

echo
echo "Step 4/5  Closing connections to '$DB_NAME'..."
psql_do -d postgres -q -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname IN ('$DB_NAME', '$STAGING_DB') AND pid <> pg_backend_pid();" >/dev/null || true

echo "Step 5/5  Switching databases by rename..."
psql_do -d postgres -q -c "ALTER DATABASE \"$DB_NAME\" RENAME TO \"$SUPERSEDED_DB\";"

if ! psql_do -d postgres -q -c "ALTER DATABASE \"$STAGING_DB\" RENAME TO \"$DB_NAME\";"; then
    echo "ERROR: could not promote the staging database. Rolling back the rename..." >&2
    psql_do -d postgres -q -c "ALTER DATABASE \"$SUPERSEDED_DB\" RENAME TO \"$DB_NAME\";" || true
    echo "       The original database is back in place as '$DB_NAME'." >&2
    exit 1
fi

cat <<EOF

Restore complete.

  Now serving   : $DB_NAME   (from $BACKUP_FILE)
  Previous data : $SUPERSEDED_DB   (kept, not deleted)
  Safety dump   : $SAFETY_DUMP

  Restart the backend so it reconnects:
    docker compose restart backend

  To roll back:
    docker compose stop backend
    psql -c 'ALTER DATABASE "$DB_NAME" RENAME TO "${DB_NAME}_rolledback_${TIMESTAMP}";'
    psql -c 'ALTER DATABASE "$SUPERSEDED_DB" RENAME TO "$DB_NAME";'
    docker compose start backend

  Once you are satisfied, reclaim the space:
    psql -c 'DROP DATABASE "$SUPERSEDED_DB";'
EOF
