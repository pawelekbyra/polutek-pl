# Production image of the Next.js app for "serwerek" (see docs/operations/SERWEREK.md, section "Produkcja na serwerku").
# Build from the repo root:
#   docker build -f deploy/serwerek/Dockerfile -t polutek-app:<tag> \
#     --build-arg NEXT_PUBLIC_APP_URL=https://www.pawelperfect.com \
#     --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... \
#     --build-arg NEXT_PUBLIC_R2_PUBLIC_HOST=thumbs.pawelperfect.pl .
# Targets: runner (default, the app), migrator (prisma CLI + migrations only, ~300 MB; used by deploy.sh).
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
ARG NEXT_PUBLIC_R2_PUBLIC_HOST=
ARG NEXT_PUBLIC_BLOB_PUBLIC_HOST=
ARG NEXT_PUBLIC_APP_NAME=
ARG NEXT_PUBLIC_SUPPORT_EMAIL=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_R2_PUBLIC_HOST=$NEXT_PUBLIC_R2_PUBLIC_HOST \
    NEXT_PUBLIC_BLOB_PUBLIC_HOST=$NEXT_PUBLIC_BLOB_PUBLIC_HOST \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
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
