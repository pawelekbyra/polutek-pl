# Deploy checklist

## Build
- [ ] `npm ci`
- [ ] `npm run env:validate:prod`
- [ ] `npx prisma validate`
- [ ] `npx prisma generate`
- [ ] `npm run quality:strict-escapes`
- [ ] `npm run typecheck`
- [ ] `npm test -- --run`
- [ ] `npm run lint`
- [ ] `npm run build`

## Review guardrails
- [ ] No new `@ts-ignore` or `@ts-nocheck` comments in production source files. If TypeScript cannot model an edge case, narrow types explicitly or document the exception outside production code.
- [ ] No new unjustified `any` escape hatches in production source files. Use `unknown`, generated Prisma types, DTOs, or local type guards instead.
- [ ] `npm run quality:strict-escapes` passes before review/merge.

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
- [ ] `ENABLE_CAMPAIGN_PAGE`
- [ ] `MAIN_CREATOR_SLUG`
- [ ] `ADMIN_CLERK_USER_IDS` (comma-separated list of Clerk IDs for immutable admin access)
- [ ] writable rate-limit Redis/KV pair: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL` + `KV_REST_API_TOKEN`
- [ ] exact media host allowlist: `MEDIA_BUCKET_HOST`, `NEXT_PUBLIC_R2_PUBLIC_HOST`, `NEXT_PUBLIC_BLOB_PUBLIC_HOST`, or `ALLOWED_MEDIA_HOSTS`
 - [ ] Production media security: confirm that gated HLS/DASH direct URLs are blocked (fail-closed 503) and only direct video files or YouTube/Vimeo are served until signed manifest delivery is active.
 - [ ] Webhook health: check dashboard/metrics/logs for webhook lock conflicts ("lock not acquired") and verify that retries are succeeding correctly.
- [ ] `HEALTHCHECK_TOKEN`

## Database
- [ ] `npx prisma generate`
- [ ] dev: `npx prisma db push`
- [ ] production: `npm run predeploy:prod` (generates client, deploys migrations, and runs `db:smoke`)
- [ ] seed if database is empty: `npx prisma db seed`

## Content
- [ ] At least one approved creator exists; production must not depend on `INITIAL_VIDEOS`/`DEFAULT_CREATOR` demo fallback data
- [ ] One video has `isMainFeatured=true`
- [ ] Public video plays through `/api/media/:videoId`
- [ ] Patron video is blocked for non-patron users
- [ ] Patron video plays for patron users

## Payments
- [ ] Stripe webhook endpoint configured
- [ ] Test payment creates/updates Payment
- [ ] Qualifying donation grants patron
- [ ] Failed payment does not grant patron

## Final smoke test
- [ ] Home page loads
- [ ] `/channel/${MAIN_CREATOR_SLUG}` loads and does not redirect to `/`
- [ ] Login works
- [ ] Guest clicking `Subskrybuj` opens Clerk sign-in
- [ ] Logged-in user can enable email notifications via `Subskrybuj`
- [ ] Logged-in user can disable email notifications via `Subskrybowano`
- [ ] Subscribed non-patron still cannot access Patron-only videos
- [ ] Patron without subscription still can access Patron-only videos
- [ ] Admin page is blocked for non-admin
- [ ] Admin can manage videos

## Vercel production migration checklist
- [ ] Vercel Build Command is `npm run vercel-build` (this repo also enforces it in `vercel.json`). The command must run `prisma migrate deploy`, `prisma generate`, `db:smoke`, then `next build` in that order.
- [ ] Vercel Production `DATABASE_URL` points to the same Postgres/Neon database used by `polutek.pl` production traffic.
- [ ] If Vercel reports `P3009` for `20260603140000_add_video_presentation_columns`, inspect the failed row and resolve it only after confirming the two columns exist or after rolling back the failed attempt:
  ```bash
  npx prisma migrate resolve --rolled-back 20260603140000_add_video_presentation_columns
  npm run vercel-build
  ```
- [ ] Confirm recent migrations on the production database:
  ```sql
  SELECT migration_name, finished_at
  FROM "_prisma_migrations"
  ORDER BY finished_at DESC;
  ```
- [ ] Confirm the migration adding `User.patronSource`, `Video.titleEn`, and `Video.descriptionEn` is listed with a non-null `finished_at`.
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
- [ ] After deploy: Vercel logs contain no Prisma `P2022`, especially no missing `User.patronSource` or `Video.titleEn` columns.
- [ ] After deploy: `npm run db:smoke` passes against the production database.

## CI/CD
- [ ] GitHub Actions `quality` job passes.
- [ ] GitHub Actions `integration-postgres` job passes with Postgres service, migrations, and `db:smoke`.
- [ ] GitHub Actions `security` job has been reviewed; `npm audit --audit-level=high` is currently non-blocking.
