#!/bin/bash
# =============================================================================
# Obtains the first Let's Encrypt certificate.
#
# There is a chicken-and-egg problem: nginx will not start when its
# ssl_certificate points at a file that does not exist, but Let's Encrypt
# cannot validate the domain until something is answering on port 80. This
# script breaks it in the usual way:
#
#   1. write a throwaway self-signed certificate so nginx can start
#   2. start nginx, which then serves the ACME challenge directory
#   3. ask Let's Encrypt for the real certificate, replacing the throwaway
#   4. reload nginx
#
# Run once, on the server, after DNS points at this machine.
# Renewal afterwards is automatic, handled by the certbot container.
#
# Usage: ./scripts/init-letsencrypt.sh <email>
#   e.g. ./scripts/init-letsencrypt.sh you@example.com
# =============================================================================

set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"
EMAIL="${1:-}"
STAGING="${STAGING:-0}"

if [ ! -f .env ]; then
    echo "ERROR: .env not found. Run ./scripts/generate-prod-env.sh first." >&2
    exit 1
fi

# shellcheck disable=SC1091
DOMAIN="$(grep -E '^DOMAIN=' .env | cut -d= -f2-)"

if [ -z "$DOMAIN" ]; then
    echo "ERROR: DOMAIN is not set in .env." >&2
    exit 1
fi
if [ -z "$EMAIL" ]; then
    echo "Usage: ./scripts/init-letsencrypt.sh <email>" >&2
    echo "  Let's Encrypt uses it only to warn you if renewal ever fails." >&2
    exit 1
fi

echo "Domain : $DOMAIN"
echo "Email  : $EMAIL"
echo

# --- Confirm DNS actually points here before spending a rate-limit attempt ---
echo "Step 1/5  Checking that $DOMAIN resolves to this machine..."
PUBLIC_IP="$(curl -s --max-time 10 https://checkip.amazonaws.com || true)"
PUBLIC_IP="$(printf '%s' "$PUBLIC_IP" | tr -d '[:space:]')"
RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"

if [ -n "$PUBLIC_IP" ] && [ -n "$RESOLVED" ] && [ "$PUBLIC_IP" != "$RESOLVED" ]; then
    echo "          WARNING: $DOMAIN resolves to $RESOLVED, this host is $PUBLIC_IP."
    echo "          Let's Encrypt will fail until DNS points here, and repeated"
    echo "          failures count against a rate limit of 5 per hour."
    printf "          Continue anyway? [y/N] "
    read -r reply
    case "$reply" in [yY]*) ;; *) echo "Stopped."; exit 1 ;; esac
elif [ -n "$RESOLVED" ]; then
    echo "          OK: $DOMAIN -> $RESOLVED"
fi

# --- Throwaway certificate so nginx can bind 443 at all ----------------------
echo "Step 2/5  Writing a temporary self-signed certificate..."
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
$COMPOSE run --rm --entrypoint "sh -c '
  mkdir -p $CERT_PATH &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout $CERT_PATH/privkey.pem \
    -out $CERT_PATH/fullchain.pem \
    -subj \"/CN=$DOMAIN\" 2>/dev/null
'" certbot

# --- Start the stack so the challenge path is served -------------------------
echo "Step 3/5  Starting the application..."
$COMPOSE up -d --build
echo "          Waiting for the web server..."
for _ in $(seq 1 30); do
    if curl -sf -o /dev/null "http://localhost/healthz"; then break; fi
    sleep 2
done

# --- Replace the throwaway with a real certificate ---------------------------
echo "Step 4/5  Requesting the certificate from Let's Encrypt..."
$COMPOSE run --rm --entrypoint "sh -c '
  rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf
'" certbot

STAGING_FLAG=""
if [ "$STAGING" = "1" ]; then
    # Untrusted certificate, but no rate limit. Use it to rehearse.
    STAGING_FLAG="--staging"
    echo "          (staging mode: the certificate will not be trusted)"
fi

$COMPOSE run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_FLAG \
    -d $DOMAIN \
    --email $EMAIL \
    --rsa-key-size 2048 \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

# --- Pick it up --------------------------------------------------------------
echo "Step 5/5  Reloading nginx..."
$COMPOSE exec frontend nginx -s reload

cat <<EOF

Certificate installed.

  Open   : https://$DOMAIN
  Renewal: automatic. The certbot container checks twice a day and renews
           when fewer than 30 days remain; nginx reloads nightly.

Verify it is genuinely trusted:

    curl -sI https://$DOMAIN | head -1
    curl -sI https://$DOMAIN | grep -i strict-transport

If you ran this with STAGING=1, repeat without it to get a trusted one.
EOF
