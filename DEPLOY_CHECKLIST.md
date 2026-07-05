# Deploy checklist

This checklist is for release/deploy verification. Passing it does **not** by itself
certify public launch: legal/operator/evidence work and the final owner launch
decision are tracked separately in GitHub issue #1269.

## Build

- [ ] Node runtime is 22.x (`.nvmrc` / `package.json#engines`; Vercel and CI must use the same major)
- [ ] `npm ci`
- [ ] `npm run env:validate:prod`
- [ ] `npx prisma validate`
- [ ] `npx prisma generate`
- [ ] `npm run quality:strict-escapes`
- [ ] `npm run quality:hotspots`
- [ ] `npm run quality:architecture-boundaries`
- [ ] `npx tsc -p tsconfig.typecheck.json --noEmit`
- [ ] `npm test -- --run`
- [ ] `npm run lint`
- [ ] `npm run build`

## Release candidate status

- [ ] Documentation updated (`README.md`, `CLAUDE.md`, `docs/README.md`, `KNOWN_LIMITATIONS.md`, active ticket files)
- [ ] GitHub issues reconciled: stale issues closed or updated, active work points to current files/code
- [ ] Code quality gates pass (`strict-escapes`, `hotspots`, `architecture-boundaries`)
- [ ] Regression tests for login/comments/subscriptions pass
- [ ] Launch/legal/operator evidence items are tracked in #1269 or in focused implementation tickets spawned from it

## Review guardrails

- [ ] No new `@ts-ignore` or `@ts-nocheck` comments in production source files. If TypeScript cannot model an edge case, narrow types explicitly or document the exception outside production code.
- [ ] No new unjustified `any` escape hatches in production source files. Use `unknown`, generated Prisma types, DTOs, or local type guards instead.
- [ ] `npm run quality:strict-escapes`, `npm run quality:hotspots`, and `npm run quality:architecture-boundaries` pass before review/merge.

## Required env variables

- [ ] `DATABASE_URL`
- [ ] `DATABASE_URL_UNPOOLED`
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `CLERK_WEBHOOK_SECRET`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `RESEND_API_KEY`
- [ ] `EMAIL_FROM`
- [ ] `ENABLE_DEMO_FALLBACKS=false` in production; demo fallback code is ignored under `NODE_ENV=production` and must not be used as production resilience
- [ ] `MAIN_CREATOR_SLUG`
- [ ] `ADMIN_CLERK_USER_IDS` (comma-separated list of Clerk IDs for immutable admin access)
- [ ] writable rate-limit Redis/KV pair: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL` + `KV_REST_API_TOKEN`
- [ ] exact media host allowlist: `MEDIA_BUCKET_HOST`, `NEXT_PUBLIC_R2_PUBLIC_HOST`, `NEXT_PUBLIC_BLOB_PUBLIC_HOST`, or `ALLOWED_MEDIA_HOSTS`
- [ ] Production media security: confirm direct files and HLS/DASH manifest URLs load only from exact allowed media hosts.
- [ ] Webhook health: check dashboard/metrics/logs for webhook lock conflicts (`lock not acquired`) and verify that retries are succeeding correctly.
- [ ] `HEALTHCHECK_TOKEN`

## Konfiguracja webhooka Clerk (wymagana dla emaili)

1. Wejdź na https://dashboard.clerk.com → twoja aplikacja → Webhooks
2. Kliknij "Add Endpoint"
3. URL: https://twojadomena.pl/api/webhooks/clerk
4. Zaznacz zdarzenia: user.created, user.updated, user.deleted, password.updated
5. Skopiuj "Signing Secret" (zaczyna się od whsec_...)
6. Dodaj do Vercel env: CLERK_WEBHOOK_SECRET=whsec_...
7. Zrób nowy deploy po dodaniu zmiennej

Aby przetestować bez rejestracji nowego użytkownika:
W Clerk Dashboard → Webhooks → kliknij endpoint → "Send test event" → user.created

## Database

- [ ] `npx prisma generate`
- [ ] dev: `npx prisma db push`
- [ ] production: migrations are run by the `Production DB Migrations` GitHub Actions workflow from the `production` environment, not by preview builds
- [ ] production smoke: `npm run db:smoke` against the production database after deploy
- [ ] seed if database is empty: `npx prisma db seed`

## Content

- [ ] At least one approved creator exists; production must not depend on `INITIAL_VIDEOS`/`DEFAULT_CREATOR` demo fallback data
- [ ] One video has `isMainFeatured=true`
- [ ] Public video plays through the current playback path
- [ ] Patron video is blocked for non-patron users
- [ ] Patron video plays for patron users
- [ ] Public legal/privacy/cookie/refund/support copy has owner/legal approval before launch traffic is invited

## Payments

- [ ] Stripe webhook endpoint configured
- [ ] Test payment creates/updates Payment
- [ ] Qualifying donation grants patron through `fulfillPayment()` and creates/keeps the canonical `PatronGrant`
- [ ] Failed payment does not grant patron
- [ ] Full refund or lost dispute revokes/suspends Patron access according to the active policy
- [ ] Below-threshold payment does not create Patron access
- [ ] Stripe PaymentIntent metadata and local `Payment` metadata clearly distinguish the two legal/payment flows:
  - `paymentPurpose=ACCESS_PURCHASE`, `grantsAccess=true`, `alreadyHadAccess=false` for a non-patron buying Strefa Fenkju access.
  - `paymentPurpose=PATRON_SUPPORT`, `grantsAccess=false`, `alreadyHadAccess=true` for an existing Patron making an extra support-box payment.
- [ ] The backend determines `paymentPurpose`, `grantsAccess`, and `alreadyHadAccess` from the server-side access state; do **not** trust a client-sent `viewerIsPatron` flag for this classification.
- [ ] Stripe Dashboard descriptions/receipts make the same split visible: access purchase = payment for digital content access; existing-Patron support = voluntary support with no new benefits, no extra access, and no access extension.
- [ ] Chargeback/refund evidence includes the relevant metadata, checkout copy, accepted terms, access state at checkout time, and whether the payment granted access.

## E2E staging configuration

- [ ] `E2E_BASE_URL` points to the deployed staging/preview URL, or local env is complete enough for `npm run dev`.
- [ ] `MAIN_CREATOR_SLUG` or `E2E_CREATOR_SLUG` points to the private beta channel.
- [ ] `E2E_PUBLIC_VIDEO_ID` points to a published `PUBLIC` video.
- [ ] `E2E_LOGGED_IN_VIDEO_ID` points to a published `LOGGED_IN` video.
- [ ] `E2E_PATRON_VIDEO_ID` points to a published `PATRON` video.
- [ ] `E2E_NON_PATRON_STORAGE_STATE` points to a Playwright storage-state JSON for a regular logged-in user who is not a Patron.
- [ ] `E2E_SUBSCRIBER_STORAGE_STATE` may point to the same user after email follow/subscription is enabled; this user still must not have Patron access.
- [ ] `E2E_ADMIN_STORAGE_STATE` points to a Playwright storage-state JSON for an admin user before admin CRUD smoke is enabled.
- [ ] Authenticated storage-state files are regenerated for the current Clerk environment before release smoke; do not reuse stale local browser state.

## Final smoke test

- [ ] Home page loads
- [ ] `/channel/${MAIN_CREATOR_SLUG}` loads and does not redirect to `/`
- [ ] Login works
- [ ] Guest clicking `Subskrybuj` opens Clerk sign-in
- [ ] Logged-in user can enable email notifications via `Subskrybuj`
- [ ] Logged-in user can disable email notifications via `Subskrybowano`
- [ ] Subscribed non-patron still cannot access Patron-only videos
- [ ] Patron without subscription still can access Patron-only videos
- [ ] Regular logged-in user can comment on a public/logged-in video but cannot comment on a Patron-only video.
- [ ] Guest checkout/create-intent requests are rejected; logged-in Stripe test-mode success creates `Payment` and qualifying Patron access.
- [ ] Full refund or lost dispute revokes Patron access (verified via `recalculateUserPatronStatus` / patron read model).
- [ ] Webhook idempotency protects against duplicate Stripe events.
- [ ] Admin page is blocked for non-admin
- [ ] Admin can manage videos
- [ ] Admin can diagnose paid-but-locked, failed webhook, access decision, and provider failure without direct DB edits
- [ ] Public unsubscribe works for logged-out recipients when using a signed token

## Vercel production migration checklist

- [ ] Vercel Build Command is `npm run vercel-build` (this repo also enforces it in `vercel.json`). This build command generates Prisma Client and builds Next.js; it does **not** deploy production migrations.
- [ ] Before or alongside each production deploy that includes Prisma migrations, manually run the GitHub Actions workflow `Production DB Migrations` from the `production` environment. The workflow runs `npm ci`, `npx prisma migrate deploy`, and `npx prisma generate` against the production database.
- [ ] Confirm GitHub Actions production secrets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` point to the same Postgres/Neon database used by production traffic.
- [ ] Do not run production migrations from Vercel preview deployments; preview builds must not mutate the production database.
- [ ] If Vercel reports `P3009` for an old migration, inspect the failed row and resolve it only after confirming the schema state or after rolling back the failed attempt.
- [ ] Confirm recent migrations on the production database:
  ```sql
  SELECT migration_name, finished_at
  FROM "_prisma_migrations"
  ORDER BY finished_at DESC;
  ```
- [ ] Confirm the migration `20260630000000_remove_legacy_user_patron_cache` is listed with a non-null `finished_at`.
- [ ] Run one of the production preflight options before deploy:
  ```bash
  npm run predeploy:prod
  npm run build
  ```
  or:
  ```bash
  npm run vercel-build
  ```
- [ ] After deploy: `/` works without `[HOME_CONTENT_LOAD_ERROR]`.
- [ ] After deploy: `/admin` works as admin.
- [ ] After deploy: `/admin/videos` works.
- [ ] After deploy: Vercel logs contain no Prisma missing-column errors for current schema fields.
- [ ] After deploy: `npm run db:smoke` passes against the production database.

## CI/CD

- [ ] GitHub Actions `environment validation` passes.
- [ ] GitHub Actions `Prisma validation/generation` passes.
- [ ] GitHub Actions `strict escapes`, `hotspots`, `architecture boundaries`, and `control-plane docs` pass.
- [ ] GitHub Actions `typecheck`, `tests/coverage`, `lint`, and `build` pass.
- [ ] GitHub Actions `integration-postgres` job passes with Postgres service, migrations, and `db:smoke`.
- [ ] GitHub Actions `security` job has been reviewed; `npm audit --audit-level=high` is currently non-blocking unless policy changes in `docs/SECURITY_GATES.md`.
- [ ] Secret scanning with push protection and CodeQL/SAST evidence is attached or linked according to `docs/SECURITY_GATES.md`.
