# Production image of the Next.js app for "serwerek" (see docs/operations/SERWEREK.md, section "Produkcja na serwerku").
# Build from the repo root:
#   docker build -f deploy/serwerek/Dockerfile -t polutek-app:<tag> \
#     --build-arg NEXT_PUBLIC_APP_URL=https://www.pawelperfect.com \
#     --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... \
#     --build-arg NEXT_PUBLIC_R2_PUBLIC_HOST=thumbs.pawelperfect.com .
# Targets: runner (default = last stage, the app), migrator (prisma CLI + migrations only, ~300 MB), worker (video encoder),
# collector (pp-collector, one 108 KB bundle on node:22-alpine, ~240 MB on disk, almost all of it the node base image); all used by deploy.sh.
# NEXT_PUBLIC_* values are PUBLIC by design (inlined into the client bundle), so passing them as build args is fine.
# Real secrets (BETTER_AUTH_SECRET, GOOGLE_CLIENT_SECRET, STRIPE_SECRET_KEY, DATABASE_URL ...) are NEVER baked in: they come from env_file at runtime.
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
# Defaults are harmless dummies so a plain `docker build` still works (test stack); production passes real values.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# Optional, patron-zone checkout only (PREMIUM_PASS_STRIPE_*): empty = the checkout uses NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
ARG NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY=
ARG NEXT_PUBLIC_R2_PUBLIC_HOST=
ARG NEXT_PUBLIC_BLOB_PUBLIC_HOST=
ARG NEXT_PUBLIC_APP_NAME=
ARG NEXT_PUBLIC_SUPPORT_EMAIL=
# Test-version stage (lib/site-stage.ts): default beta; set false at launch (build.env: NEXT_PUBLIC_SITE_BETA=false).
ARG NEXT_PUBLIC_SITE_BETA=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_R2_PUBLIC_HOST=$NEXT_PUBLIC_R2_PUBLIC_HOST \
    NEXT_PUBLIC_BLOB_PUBLIC_HOST=$NEXT_PUBLIC_BLOB_PUBLIC_HOST \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_PUBLIC_SITE_BETA=$NEXT_PUBLIC_SITE_BETA \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=3072
COPY . .
RUN npx prisma generate && npx next build

# Only the prisma CLI + schema + migrations (no app node_modules), version pinned from package-lock.json.
FROM node:22-bookworm-slim AS migrator
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package-lock.json ./
RUN PRISMA_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
    && npm init -y >/dev/null && npm install --no-audit --no-fund "prisma@${PRISMA_VERSION}" "@prisma/client@${PRISMA_VERSION}"
COPY prisma ./prisma
ENV NEXT_TELEMETRY_DISABLED=1
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# Own video pipeline worker (scripts/video-worker.ts): pulls encode jobs from Postgres, runs ffmpeg, uploads HLS to R2.
# Static ffmpeg of the same version the encoder was validated with (8.0.1); needs the full node_modules (tsx, prisma client, aws sdk).
# Never part of the Next.js process. Runbook: docs/operations/VIDEO-PIPELINE.md.
FROM mwader/static-ffmpeg:8.0.1 AS ffmpeg

FROM node:22-bookworm-slim AS worker
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 VIDEO_WORKER_WORK_DIR=/work
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node lib ./lib
COPY --chown=node:node app ./app
COPY --chown=node:node components ./components
COPY --chown=node:node scripts ./scripts
RUN mkdir -p /work && chown node:node /work
USER node
CMD ["node_modules/.bin/tsx", "scripts/video-worker.ts"]

# pp-collector (services/pp-collector): analytics beacons -> Postgres schema "telemetry", rollups, retention.
# One esbuild bundle (zod + postgres.js inlined), no node_modules: ~25 MB RAM under load. Docs: docs/architecture/admin-telemetry.md.
FROM deps AS collector-build
COPY lib/telemetry ./lib/telemetry
COPY services/pp-collector ./services/pp-collector
RUN npm run collector:build

FROM node:22-alpine AS collector
WORKDIR /app
ENV NODE_ENV=production PORT=3200
COPY --from=collector-build --chown=node:node /app/dist/pp-collector/collector.cjs ./collector.cjs
USER node
EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3   CMD node -e "fetch('http://127.0.0.1:3200/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--max-old-space-size=48", "collector.cjs"]

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# next/image writes its optimizer cache to .next/cache at runtime; the standalone tree is created by root.
RUN mkdir -p /app/.next/cache && chown -R node:node /app/.next
USER node
EXPOSE 3000
# /api/health is a public route (middleware.ts); any non-5xx means the server is up and answering.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
