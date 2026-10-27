#!/bin/sh
set -eu

# A domain is inserted into nginx config, so reject whitespace and config syntax.
case "${DOMAIN:-}" in
    ''|*[!a-zA-Z0-9.-]*|.*|*..*|*.) echo "Set DOMAIN to a valid hostname." >&2; exit 1 ;;
esac
CERT=/etc/letsencrypt/live/wordloom/fullchain.pem
KEY=/etc/letsencrypt/live/wordloom/privkey.pem
CONFIG=/etc/nginx/conf.d/default.conf

signature() {
    if [ -s "$CERT" ] && [ -s "$KEY" ]; then
        cksum "$CERT" "$KEY"
    else
        printf '%s\n' missing
    fi
}

render() {
    template=http
    if [ -s "$CERT" ] && [ -s "$KEY" ]; then template=https; fi
    # Only substitute DOMAIN; retain nginx's $uri and $request_uri variables.
    envsubst '${DOMAIN}' < "/etc/wordloom-nginx/$template.conf.template" > "$CONFIG"
}

cp /etc/wordloom-nginx/health.conf /etc/nginx/conf.d/health.conf
initial=$(signature)
render
nginx -t
(
    previous=$initial
    while sleep 60; do
        current=$(signature)
        if [ "$current" != "$previous" ]; then
            cp "$CONFIG" /tmp/wordloom-nginx-previous.conf
            render
            if nginx -t && nginx -s reload; then
                previous=$current
                echo "Nginx certificate/configuration reloaded."
            else
                cp /tmp/wordloom-nginx-previous.conf "$CONFIG"
                echo "Nginx reload failed; retained previous configuration." >&2
            fi
        fi
    done
) &
exec nginx -g 'daemon off;'
