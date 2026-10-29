#!/bin/bash
# ============================================================================
# Adatya PostgreSQL backup.
#
# Reaches the database the same way restore-db.sh does: a local psql client if
# one is installed, otherwise through the Docker container, which is how
# Adatya normally runs. In production the database port is deliberately not
# published to the host, so the container path is the only one that works
# there.
#
# Safe to run from cron. Cron starts with almost no environment, so the
# credentials are read from .env rather than assumed to be exported.
#
# Usage: ./scripts/backup-db.sh
# ============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

# Cron gives us no environment. Take the database settings from .env when it
# is there, without clobbering anything already set in the shell.
if [ -f .env ]; then
    while IFS='=' read -r key value; do
        case "$key" in
            POSTGRES_DB|DB_USERNAME|DB_PASSWORD)
                if [ -z "${!key:-}" ]; then export "$key=$value"; fi
                ;;
        esac
    done < <(grep -E '^(POSTGRES_DB|DB_USERNAME|DB_PASSWORD)=' .env || true)
fi

DB_NAME="${POSTGRES_DB:-adatya_db}"
DB_USER="${POSTGRES_USER:-${DB_USERNAME:-postgres}}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_CONTAINER="${ADATYA_DB_CONTAINER:-adatya-database}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/adatya_db_backup_${TIMESTAMP}.sql.gz"

# ---------------------------------------------------------------------------
# Decide how to reach PostgreSQL.
# ---------------------------------------------------------------------------
if command -v pg_dump >/dev/null 2>&1; then
    MODE="native ${DB_HOST}:${DB_PORT}"
    pgdump_do() { PGPASSWORD="${DB_PASSWORD:-}" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"; }
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    MODE="docker ($DB_CONTAINER)"
    pgdump_do() { docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$@"; }
else
    echo "ERROR: no pg_dump on PATH and the '$DB_CONTAINER' container is not running." >&2
    echo "       Start the stack, or install the PostgreSQL client tools." >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Backing up '${DB_NAME}' as user '${DB_USER}' via ${MODE}..."

# Write to a partial file first. A backup that is interrupted half way through
# must not be left behind looking like a usable one.
if ! pgdump_do "$DB_NAME" | gzip > "${BACKUP_FILE}.partial"; then
    rm -f "${BACKUP_FILE}.partial"
    echo "ERROR: pg_dump failed; no backup was written." >&2
    exit 1
fi

# gzip of an empty or failed dump is still a few bytes, so check for substance.
SIZE_BYTES="$(wc -c < "${BACKUP_FILE}.partial" | tr -d '[:space:]')"
if [ "$SIZE_BYTES" -lt 1000 ]; then
    rm -f "${BACKUP_FILE}.partial"
    echo "ERROR: the dump was only ${SIZE_BYTES} bytes, which cannot be a real" >&2
    echo "       backup. Nothing was kept. Check the database is reachable." >&2
    exit 1
fi

mv "${BACKUP_FILE}.partial" "$BACKUP_FILE"

echo "Backup written: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# ---------------------------------------------------------------------------
# Retention. Only ever touches this script's own timestamped backup files, and
# only once a new one has been written successfully above.
# ---------------------------------------------------------------------------
PRUNED="$(find "$BACKUP_DIR" -maxdepth 1 -name 'adatya_db_backup_*.sql.gz' -type f -mtime "+${RETAIN_DAYS}" -print -delete | wc -l | tr -d '[:space:]')"
echo "Retention: keeping ${RETAIN_DAYS} days; removed ${PRUNED} older backup(s)."
