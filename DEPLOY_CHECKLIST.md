# Deploy checklist

## Build
- [ ] `npm install`
- [ ] `npx prisma generate`
- [ ] `npm run lint`
- [ ] `npm run build`

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
- [ ] `ENABLE_DEMO_FALLBACKS`
- [ ] `ENABLE_CAMPAIGN_PAGE`

## Database
- [ ] `npx prisma generate`
- [ ] dev: `npx prisma db push`
- [ ] production: `npm run predeploy:prod` (generates client, deploys migrations, and runs `db:smoke`)
- [ ] seed if database is empty: `npx prisma db seed`

## Content
- [ ] At least one approved creator exists
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
- [ ] Channel page loads
- [ ] Login works
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
