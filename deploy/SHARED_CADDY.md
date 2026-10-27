# Shared Caddy setup

Wordloom runs only an internal HTTP app. Existing Caddy manages HTTPS and the existing DuckDNS updater must include wordloom.duckdns.org.

## Wordloom directory

Use the existing external network. If Caddy uses another network name, set the same PROXY_NETWORK in Wordloom's .env.

```sh
docker network inspect mac-mini-proxy
docker compose config --quiet
docker compose up -d --build --remove-orphans
docker compose ps
```

The Compose project remains named wordloom. --remove-orphans removes its previous standalone DuckDNS and Certbot containers, while the separate mac-mini-proxy project stays running. Volumes are preserved. No host ports are published.

## Existing Caddy directory

Add this block to config/Caddyfile, retaining existing sites. If this domain already has a block, update that block instead of duplicating it. If using imported site files, ensure the new block is imported by the active Caddyfile.

```caddyfile
wordloom.duckdns.org {
    reverse_proxy wordloom-origin:80
}
```

Run from the existing Caddy Compose directory:

```sh
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose logs --tail=80 caddy
```

Keep the existing router TCP 80/443 forwarding to Caddy. Wordloom does not run Certbot or update DNS.

```sh
curl -I https://wordloom.duckdns.org
curl -fsS https://wordloom.duckdns.org/data/catalog-manifest.json
curl -fsS https://wordloom.duckdns.org/data/packs/core-13.json
```

For 502, check app status and both containers' shared network membership. For TLS errors, check Caddy logs, DNS A/AAAA records and router forwarding. Wait for offline readiness in the app before disconnecting.

Compose configuration and the 6,500-word artifact are locally validated. Actual Mac container execution and public TLS issuance still need server verification.
