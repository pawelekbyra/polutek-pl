# POLUTEK.PL - Private VOD & Donation Platform

## Important for AI coding agents
Before changing code, read `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `KNOWN_LIMITATIONS.md`, and `DEPLOY_CHECKLIST.md`.
This project should be developed according to product behavior, not only technical stack.

A modern, responsive media platform for exclusive content, built with Next.js 14, Tailwind CSS, and Prisma. This project is designed with a professional "YouTube-style" aesthetic and features a permanent content locking mechanism for supporters based on lifetime donation value.

## Project Vision
POLUTEK.PL is a private service. It serves as a central hub for exclusive media where users can gain permanent access to restricted "Materials" by leaving a voluntary donation.

### Key Concept: Reward for Support
- **Not a Subscription**: We don't sell access as a service. Instead, we accept voluntary donations and grant permanent access as a token of gratitude.
- **Patron Status**: Patron status is currently granted by a single qualifying donation. Payment totals are tracked per currency (`UserPaymentTotal`) which is the primary source of truth for total value.
- **Public Discovery**: One primary featured video is always public, serving as a gateway to the platform.

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

### Neon DB Configuration Example
```env
# Recommended for most uses (pooled)
DATABASE_URL="postgresql://[user]:[password]@[host]-pooler.[region].aws.neon.tech/[db_name]?sslmode=require"

# For migrations and direct access (unpooled)
DATABASE_URL_UNPOOLED="postgresql://[user]:[password]@[host].[region].aws.neon.tech/[db_name]?sslmode=require"

# Host parameters
PGHOST="[host]-pooler.[region].aws.neon.tech"
PGHOST_UNPOOLED="[host].[region].aws.neon.tech"
PGUSER="[user]"
PGDATABASE="[db_name]"
PGPASSWORD="[password]"
```

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

### Local content for the homepage
The homepage reads real `PUBLISHED` videos from the database. Demo fallback data remains opt-in only and is not enabled by omission. To get visible materials locally, use one of these paths:

1. Seed development data:
   ```bash
   npm run db:migrate:dev
   npm run db:seed
   ```
   The seed creates an approved primary `polutek` creator and published videos with `publishedAt` set. By default it uses `/wuthering.jpg` for thumbnails and `https://media.localhost.invalid/demo-video.mp4` as a placeholder media URL. For playable local media through `/api/media/:videoId`, set exact hosts before seeding/running the app, for example:
   ```env
   SEED_MEDIA_URL=https://media.example.test/demo-video.mp4
   SEED_THUMBNAIL_URL=/wuthering.jpg
   ALLOWED_MEDIA_HOSTS=media.example.test
   ```
2. Add a video in the admin panel with status `PUBLISHED`; the backend sets `publishedAt` automatically and attaches it to the approved `polutek` creator.
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
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are required in production. If either value is missing with `NODE_ENV=production`, the application fails fast instead of falling back to an in-memory limiter. The in-memory limiter exists only for local development and tests because serverless memory is per-instance and resets on cold starts.

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

- Partial refund: payment status becomes `PARTIALLY_REFUNDED`, `User.totalPaidMinor` and `UserPaymentTotal.amountMinor` are reduced to net paid totals, and patron grants are retained.
- Full refund: payment status becomes `REFUNDED`, net totals are reduced, and patron grants tied to that payment are revoked.
- Lost chargeback/dispute: payment status becomes `CHARGEBACK_LOST`, the remaining net paid amount (`amountMinor - refundedAmountMinor`) is removed from `User.totalPaidMinor` and `UserPaymentTotal.amountMinor`, and patron grants tied to that payment are revoked.

Clerk `publicMetadata.totalPaid` is synchronized from net normalized payment totals after refund/dispute handling.

### Clerk webhook idempotency
`ClerkEvent` records webhook delivery ids and prevents duplicate side effects. `PROCESSED` events are skipped, `FAILED` events can be retried, and `PROCESSING` events are retried after a five-minute staleness timeout so a crashed worker cannot block an event forever.

### Production deploy order
Use this order for deployments:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

Required production environment groups: database URLs, Clerk keys and webhook secret, Stripe keys and webhook secret, Resend email settings, Upstash Redis REST URL/token, exact media host allowlist values, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAIL`, and `HEALTHCHECK_TOKEN`.

### Upstash Redis / Vercel KV
Required in Production for `/api/media` and `/api/checkout/create-intent`. Without these, endpoints will return a controlled 503 error.

```env
UPSTASH_REDIS_REST_URL="https://your-host.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"

# Optional Vercel KV Aliases
KV_REST_API_URL="https://your-host.upstash.io"
KV_REST_API_TOKEN="your-token"
KV_REST_API_READ_ONLY_TOKEN="your-readonly-token"
KV_URL="rediss://default:your-token@your-host.upstash.io:6379"
```
