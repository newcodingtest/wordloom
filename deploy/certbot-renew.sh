#!/bin/sh
set -eu

if [ "${1:-}" = "--issue" ]; then
    shift
    : "${DOMAIN:?Set DOMAIN or DUCKDNS_SUBDOMAIN}"
    : "${LETSENCRYPT_EMAIL:?Set LETSENCRYPT_EMAIL in .env}"
    case "$DOMAIN" in
        *[!a-zA-Z0-9.-]*|.*|*..*|*.) echo "Invalid DOMAIN." >&2; exit 1 ;;
    esac
    case "$LETSENCRYPT_EMAIL" in
        you@example.com|*@example.com|*@example.invalid) echo "Set your real LETSENCRYPT_EMAIL." >&2; exit 1 ;;
    esac
    exec certbot certonly --non-interactive --agree-tos \
        --webroot --webroot-path /var/www/certbot \
        --cert-name wordloom --domain "$DOMAIN" \
        --email "$LETSENCRYPT_EMAIL" --keep-until-expiring "$@"
fi
if [ "$#" -gt 0 ]; then exec certbot "$@"; fi

# Certbot renew only attempts certificates that are due for renewal.
trap 'exit 0' TERM INT
while :; do
    if ! certbot renew --webroot --webroot-path /var/www/certbot --quiet; then
        echo "Certificate renewal failed; retrying in 12 hours." >&2
    fi
    sleep 43200 &
    wait $!
done
