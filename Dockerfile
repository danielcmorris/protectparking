# syntax=docker/dockerfile:1
#
# Root Dockerfile for Cloud Run's auto-build-on-checkin.
# Cloud Run's default GitHub build expects the Dockerfile at the repo root
# (/workspace/Dockerfile) with the repo root as build context, so this builds
# the API from the api/ subdirectory. (api/Dockerfile remains for builds whose
# context is the api/ folder, e.g. docker-compose.)

# ---- deps ----
FROM node:20-slim AS deps
WORKDIR /app
COPY api/package.json api/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# ---- runtime ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY api/package.json ./
COPY api/src ./src
COPY api/db ./db
# Static campaign site, served by the API at / (see src/server.js).
COPY site ./site

USER node

# Cloud Run injects PORT (defaults to 8080); the app reads it from env.
EXPOSE 8080
CMD ["node", "src/server.js"]
