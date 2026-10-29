#!/bin/bash
# =============================================================================
# Generates the production .env with fresh secrets.
#
# Run this ON THE SERVER, once. It never reuses the development values: the
# local .env secrets are on a laptop, in shell history and in backups, so
# treating them as production credentials would be a mistake.
#
# Secrets are written to the file and never printed to the terminal, so they
# do not end up in scrollback or in a screen share.
#
# Usage: ./scripts/generate-prod-env.sh <domain> <admin-mobile>
#   e.g. ./scripts/generate-prod-env.sh adatya.duckdns.org 9876543210
# =============================================================================

set -euo pipefail

DOMAIN="${1:-}"
ADMIN_MOBILE="${2:-}"
ENV_FILE=".env"

if [ -z "$DOMAIN" ] || [ -z "$ADMIN_MOBILE" ]; then
    echo "Usage: ./scripts/generate-prod-env.sh <domain> <admin-mobile>" >&2
    echo "  e.g. ./scripts/generate-prod-env.sh adatya.duckdns.org 9876543210" >&2
    exit 1
fi

if ! printf '%s' "$ADMIN_MOBILE" | grep -Eq '^[6-9][0-9]{9}$'; then
    echo "ERROR: the admin mobile must be 10 digits starting with 6, 7, 8 or 9." >&2
    exit 1
fi

if [ -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE already exists." >&2
    echo "       Refusing to overwrite it; rotating secrets under a running" >&2
    echo "       deployment would lock every signed-in trader out and could" >&2
    echo "       leave the database unreachable." >&2
    echo "       Move it aside first if you really mean to regenerate." >&2
    exit 1
fi

# openssl is present on Amazon Linux and Ubuntu images; fall back to urandom.
random_secret() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 "$1" | tr -d '\n=' | tr '+/' '-_'
    else
        head -c "$1" /dev/urandom | base64 | tr -d '\n=' | tr '+/' '-_'
    fi
}

JWT_SECRET="$(random_secret 48)"
DB_PASSWORD="$(random_secret 24)"
ADMIN_PASSWORD="$(random_secret 12)a1"   # satisfies the 8+ letter+digit policy

umask 077
cat > "$ENV_FILE" <<EOF
# =============================================================================
# Adatya production environment. Generated $(date -u +%Y-%m-%dT%H:%M:%SZ).
#
# This file holds live credentials. It is gitignored, readable only by this
# user, and must never be committed, pasted or shared.
# =============================================================================

# --- Public hostname ---------------------------------------------------------
DOMAIN=$DOMAIN

# The browser blocks API calls from an origin not listed here, so it must be
# the https:// form of the domain above.
CORS_ALLOWED_ORIGINS=https://$DOMAIN

# --- Database ----------------------------------------------------------------
POSTGRES_DB=adatya_db
DB_USERNAME=adatya
DB_PASSWORD=$DB_PASSWORD
DB_URL=jdbc:postgresql://database:5432/adatya_db
DB_POOL_MAX=10
DB_POOL_MIN=2

# Flyway owns the schema. Never set this to update or create in production.
HIBERNATE_DDL_AUTO=validate

# --- Authentication ----------------------------------------------------------
JWT_SECRET=$JWT_SECRET
JWT_TTL_MINUTES=720

# --- One-time owner account --------------------------------------------------
# Seeded on first boot only. Sign in, change the password from Profile, then
# blank both of these and restart the backend.
DEFAULT_ADMIN_MOBILE=$ADMIN_MOBILE
DEFAULT_ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

chmod 600 "$ENV_FILE"

cat <<EOF

Wrote $ENV_FILE with freshly generated secrets (permissions 600).

  Domain      : $DOMAIN
  Database    : adatya_db as user "adatya"
  Admin login : $ADMIN_MOBILE

Your one-time admin password is in $ENV_FILE on the line
DEFAULT_ADMIN_PASSWORD. Read it there, sign in, change it from Profile,
then blank DEFAULT_ADMIN_MOBILE and DEFAULT_ADMIN_PASSWORD and restart:

    docker compose -f docker-compose.prod.yml up -d backend

It is not printed here on purpose, so it stays out of your terminal history.
EOF
