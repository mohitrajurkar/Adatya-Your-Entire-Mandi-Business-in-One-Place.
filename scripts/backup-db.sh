#!/bin/bash
# ========================================================
# Adatya PostgreSQL Automated Backup Script (Native)
# ========================================================

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/adatya_db_backup_${TIMESTAMP}.sql.gz"

DB_NAME="${POSTGRES_DB:-adatya_db}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

mkdir -p "$BACKUP_DIR"

echo "💾 Starting backup of database '${DB_NAME}' on ${DB_HOST}:${DB_PORT}..."

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "✅ Backup successfully created at: $BACKUP_FILE"
echo "📊 File size: $(du -h "$BACKUP_FILE" | cut -f1)"

# Keep only the latest 14 daily backups
find "$BACKUP_DIR" -name "adatya_db_backup_*.sql.gz" -type f -mtime +14 -exec rm -f {} \;
echo "🧹 Old backups cleaned up (retained last 14 days)."
