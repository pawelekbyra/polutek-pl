# Paweł Perfect - Private VOD & Donation Platform

## Important for AI coding agents
Before changing code, read `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `KNOWN_LIMITATIONS.md`, and `DEPLOY_CHECKLIST.md`.
This project should be developed according to product behavior, not only technical stack.

A modern, responsive media platform for exclusive content, built with Next.js 14, Tailwind CSS, and Prisma. This project is designed with a professional "YouTube-style" aesthetic and features a permanent content locking mechanism for supporters based on lifetime donation value.

## Project Vision
Paweł Perfect is a private service. It serves as a central hub for exclusive media where users can gain permanent access to restricted "Materials" by leaving a voluntary donation.

### Key Concept: Reward for Support
- **Not a Subscription**: We don't sell access as a service. Instead, we accept voluntary donations and grant permanent access as a token of gratitude.
- **Patron Status**: Patron status is currently granted by a single qualifying donation. Payment totals are tracked per currency (`UserPaymentTotal`) which is the primary source of truth for total value.
- **Public Discovery**: One primary featured video is always public, serving as a gateway to the platform.

## Current App Mode
The portal currently runs as a **single-creator / monokanał VOD**. By default, `ENABLE_MULTI_CREATOR=false` keeps the homepage scoped to the creator configured in `MAIN_CREATOR_SLUG` (currently `polutek`) and redirects that creator's channel URL back to `/` to avoid duplicate SEO content.

Multi-creator support remains a future platform mode and should be enabled explicitly with `ENABLE_MULTI_CREATOR=true` only when open creator discovery/onboarding is ready.

## Architecture & Scalability
The platform is built with future growth and high performance in mind:

- **Multi-Tenancy**: The current production scenario is one primary channel. The data model prepares for selected users to create channels in the future, but full multi-creator onboarding is not implemented yet.
- **Clean Architecture**: Business logic is decoupled from API routes into a dedicated Service Layer (`lib/services/`), facilitating testing and maintainability.
- **Connection Pooling**: Optimized for serverless environments using connection pooling to prevent database exhaustion.
- **Secure VOD Delivery**: Secure media delivery through `/api/media/:videoId` with access checks and range-request support. HLS/DASH can be added later.
- **Social Features**: Multi-level threaded comments, image attachments, and likes for high community engagement.

## Technology Stack
- **Framework**: [Next.js 14 (App Router)](https://nextjs.org/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Database**: [Postgres (Neon/Supabase)](https://neon.tech/) with [Prisma 6+](https://www.prisma.io/)
- **Payments**: [Stripe](https://stripe.com/)
- **Storage**: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
- **Email**: [Resend](https://resend.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)

## Database Configuration

This project uses Prisma with PostgreSQL. It requires two database connection strings in your environment variables:

- `DATABASE_URL`: Can be a pooled connection string (e.g., using Prisma Accelerate or Neon's connection pooling).
- `DATABASE_URL_UNPOOLED`: Should be a direct/unpooled connection string. This is used by Prisma for migrations and other direct database operations.
  - *Note: If your environment does not provide a separate direct URL, you can temporarily set `DATABASE_URL_UNPOOLED` to the same value as `DATABASE_URL`, but a dedicated direct URL is recommended for production.*

## Getting Started

### Prerequisites
- Node.js 18+
- Postgres instance
- Clerk project keys
- Stripe account & webhook secret

### Installation
```bash
npm install
npx prisma generate
npm run dev
```

### Database Migrations
For local development, create/apply migrations with:
```bash
npm run db:migrate:dev
```
For production environments, deploy checked-in migrations only:
```bash
npm run db:migrate:deploy
# equivalent: npx prisma migrate deploy
```
`npm run db:push` / `npx prisma db push` is reserved for local prototyping only and must not be used for production deploys.

*Note: Production deployments must use `prisma migrate deploy` to ensure database schema consistency. Hard delete of production data is discouraged; prefer status updates (e.g., `VideoStatus.ARCHIVED`).*

### Creator Studio v1 Features
The admin panel at `/admin` includes several enhancements for content management:
- **Scoped Hero Videos**: Toggling a video as "Hero" (isMainFeatured) only unsets other featured videos for the **same creator**, supporting multi-creator environments.
- **Manual Sidebar Ordering**: Use the `sidebarOrder` field to manually prioritize videos in the sidebar. Sorting follows `sidebarOrder` (desc), then `publishedAt` (desc).
- **Smart Creator Selection**: New videos are automatically assigned to the primary creator (`isPrimary: true`) or fallback to the creator configured by `MAIN_CREATOR_SLUG`.
- **Safety Constraints**: The system prevents setting non-public or non-published videos as the main featured material.

### Local content for the homepage
The homepage reads real `PUBLISHED` videos from the database. Demo fallback data remains opt-in only and is not enabled by omission. To get visible materials locally, use one of these paths:

1. **Seed MVP Content (Paweł Perfect)**:
   This is the recommended path for the initial setup. It initializes the "Paweł Perfect" channel and populates the main featured video.
   ```bash
   # 1. Ensure migrations are applied
   npm run db:migrate:dev

   # 2. Run the main seed script
   npm run db:seed

   # 3. Run the content fix script to ensure MVP branding
   npm run content:fix:polutek
   ```
   The seed creates the primary `polutek` creator named "Paweł Perfect" and sets the main featured video using its R2 URL.

2. Add a video in the admin panel with status `PUBLISHED`; the backend sets `publishedAt` automatically and attaches it to the approved creator.
3. For local/demo development only, explicitly opt in to fallback content:
   ```env
   ENABLE_DEMO_FALLBACKS=true
   ```
   Do not rely on this in production.

### Testing
Run unit tests with Vitest:
```bash
npm test
```

## Verification Checklist
1. [ ] Homepage loads correctly with a featured video.
2. [ ] Homepage shows "No materials" state when the database is empty.
3. [ ] Public videos play via `/api/media/:id`.
4. [ ] Direct `videoUrl` is not present in public component props or DTOs.
5. [ ] `REGISTERED` tier videos show paywall for guest users.
6. [ ] `PATRON` tier videos show paywall for regular logged-in users.
7. [ ] `PATRON` tier videos are accessible to patrons.
8. [ ] Stripe webhook correctly fulfills payments and grants Patron status.
9. [ ] Reaching the referral goal (5 points) grants Patron status and syncs to Clerk.
10. [ ] Webhook idempotency prevents double-processing of Stripe events.

## Legal
The platform operates on a donation basis. All "Tips" or "Donations" are voluntary contributions to the creator, not payments for services or products. Detailed terms are available on the `/regulamin` page.

## Production hardening requirements

### Rate limiting
Production rate limiting requires writable Upstash Redis REST credentials. Configure either `UPSTASH_REDIS_REST_URL` plus `UPSTASH_REDIS_REST_TOKEN`, or the Vercel KV fallback names `KV_REST_API_URL` plus `KV_REST_API_TOKEN`. Do not use `KV_REST_API_READ_ONLY_TOKEN` for rate limiting because the limiter must write counters. If no writable pair is available with `NODE_ENV=production`, the application logs `Missing Redis env vars: set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN.` and fails fast instead of falling back to an in-memory limiter. The in-memory limiter exists only for local development and tests because serverless memory is per-instance and resets on cold starts.

`/api/media/:videoId` is rate-limited per authenticated user (or client IP for guests) and per media id. The limit is intentionally higher than comment limits to allow normal video player `Range` requests while still bounding streaming costs.

### Media host allowlist
The media proxy is not a generic image or URL proxy. It accepts only exact HTTPS hosts configured through:

```env
MEDIA_BUCKET_HOST=
NEXT_PUBLIC_R2_PUBLIC_HOST=
NEXT_PUBLIC_BLOB_PUBLIC_HOST=
ALLOWED_MEDIA_HOSTS=
```

Configure concrete bucket/CDN hosts such as `my-bucket.example.r2.dev` or `media.example.com`; do not configure broad provider domains such as `r2.dev`, `r2.cloudflarestorage.com`, or `vercel-storage.com`. Subdomains are not implicitly trusted—add each required host explicitly.

### Refund and dispute policy
Payments store `refundedAmountMinor` so refund webhooks are idempotent by amount. A repeated Stripe refund event does not subtract totals twice.

- Partial refund: payment status becomes `PARTIALLY_REFUNDED`, `UserPaymentTotal.amountMinor` is reduced to net paid totals, and patron grants are retained.
- Full refund: payment status becomes `REFUNDED`, net totals are reduced, and patron grants tied to that payment are revoked.
- Lost chargeback/dispute: payment status becomes `CHARGEBACK_LOST`, the remaining net paid amount (`amountMinor - refundedAmountMinor`) is removed from `UserPaymentTotal.amountMinor`, and patron grants tied to that payment are revoked.

Clerk `publicMetadata.totalPaid` is synchronized from net normalized payment totals after refund/dispute handling.

### Clerk webhook idempotency
`ClerkEvent` records webhook delivery ids and prevents duplicate side effects. `PROCESSED` events are skipped, `FAILED` events can be retried, and `PROCESSING` events are retried after a five-minute staleness timeout so a crashed worker cannot block an event forever.

### Production deploy order
Vercel uses the `vercel-build` npm script, which runs production migrations before building. A deploy must fail rather than build against a database that has not received the current Prisma migrations.

Use this order for manual deployments and when debugging Vercel builds:

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
npm run db:smoke
npm run build
```

The `db:smoke` check performs minimal Prisma `findFirst` queries that select critical columns including `User.isPatron`, `User.patronSince`, `User.patronSource`, `Video.titleEn`, `Video.descriptionEn`, `PatronGrant.paymentId`, and `PatronGrant.referralId`. A `P2022` failure means the active `DATABASE_URL` still has schema drift and must be migrated before traffic is promoted.

Required production environment groups: database URLs available during the Vercel build (`DATABASE_URL` and, when used, `DATABASE_URL_UNPOOLED`), Clerk keys and webhook secret, Stripe keys and webhook secret, Resend email settings, writable Redis REST URL/token (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` or Vercel `KV_REST_API_URL`/`KV_REST_API_TOKEN`), exact media host allowlist values, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAIL`, `PATRON_MIN_TIP_AMOUNT`, and `HEALTHCHECK_TOKEN`.

Before promoting the deployment, verify `/`, `/admin`, `/admin/videos`, `/admin/channel`, `/admin/users`, `/admin/emails`, `/api/media/:videoId`, and `/api/checkout/create-intent` do not return 500 responses, and confirm Vercel logs no longer contain missing-column `P2022` errors such as `Video.titleEn` or `User.patronSource`.
