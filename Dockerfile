# syntax=docker/dockerfile:1
FROM python:3.13-alpine AS vocabulary-build
WORKDIR /site
COPY scripts/ ./scripts/
COPY data/ ./data/
COPY icons/ ./icons/
COPY index.html styles.css app.js db.js learning.js sw.js manifest.webmanifest ./
RUN python scripts/build-release.py

# Internal HTTP origin; HTTPS and DNS are managed by the existing server.
FROM nginx:1.30.6-alpine AS app
COPY deploy/nginx/ /etc/wordloom-nginx/
COPY deploy/nginx/proxy.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/health.conf /etc/nginx/conf.d/health.conf
COPY --from=vocabulary-build /site/dist/ /usr/share/nginx/html/
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
