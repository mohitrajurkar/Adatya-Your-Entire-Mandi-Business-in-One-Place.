#!/bin/bash
# ========================================================
# Adatya PostgreSQL Restore Script (Native)
# Usage: ./scripts/restore-db.sh <path-to-backup.sql.gz>
# ========================================================

set -e

if [ -z "$1" ]; then
    echo "❌ Error: Please specify the backup file path to restore."
    echo "Usage: ./scripts/restore-db.sh ./backups/adatya_db_backup_YYYYMMDD_HHMMSS.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"
DB_NAME="${POSTGRES_DB:-adatya_db}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file '$BACKUP_FILE' not found."
    exit 1
fi

echo "⚠️ WARNING: This will overwrite the '${DB_NAME}' database on ${DB_HOST}:${DB_PORT}."
read -p "Are you sure you want to proceed? (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Restoration aborted."
    exit 0
fi

echo "🔄 Restoring database from $BACKUP_FILE..."

# Terminate active backend connections to allow clean restore
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" || true

# Drop and recreate database
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"

# Restore dump
gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"

echo "✅ Database restore complete!"
