# syntax=docker/dockerfile:1
FROM python:3.13-alpine AS vocabulary-build
WORKDIR /site
COPY scripts/ ./scripts/
COPY data/ ./data/
COPY icons/ ./icons/
COPY index.html styles.css app.js db.js learning.js sw.js manifest.webmanifest ./
RUN python scripts/build-release.py

FROM python:3.13-alpine AS duckdns
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY deploy/duckdns-update.py ./duckdns-update.py
USER 65534:65534
ENTRYPOINT ["python", "/app/duckdns-update.py"]

FROM certbot/certbot:v5.8.0 AS certbot
COPY deploy/certbot-renew.sh /usr/local/bin/wordloom-certbot.sh
ENTRYPOINT ["/bin/sh", "/usr/local/bin/wordloom-certbot.sh"]

FROM nginx:1.30.6-alpine AS app
COPY deploy/nginx/ /etc/wordloom-nginx/
COPY deploy/nginx-start.sh /usr/local/bin/wordloom-nginx.sh
COPY --from=vocabulary-build /site/dist/ /usr/share/nginx/html/
ENTRYPOINT ["/bin/sh", "/usr/local/bin/wordloom-nginx.sh"]
CMD []
