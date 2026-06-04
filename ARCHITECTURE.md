# Architecture

## Current product mode

Kraufanding currently runs as a single-creator VOD with data-model support for a future multi-creator mode. `MAIN_CREATOR_SLUG` is the dynamic source for the configured creator in single-creator mode; code should not add new hardcoded creator/channel slugs as technical fallbacks.

## Main flows

* **Public video playback**: Served through `/api/media/:videoId` for `PUBLIC` videos, with media-host allowlist checks and range-request support.
* **Logged-in video playback**: Requires a Clerk-authenticated session for `LOGGED_IN` videos.
* **Patron video playback**: Requires `User.isPatron` in the database for `PATRON` videos. `Subscription` records must not grant premium access.
* **Donation to Patron**: Stripe checkout/webhooks create payments and patron grants. Refund/dispute handling recalculates net totals and patron status.
* **Referral to Patron**: Referral grants are represented through `PatronGrant` and synchronized through user access services.
* **Channel subscription / follow**: `/api/subscriptions` is an email-notification opt-in/out for a creator. It is authenticated, validates the creator, is rate-limited, and writes only `Subscription` rows.
* **Admin video/channel management**: Restricted to `ADMIN` role and protected at API/service boundaries, not just UI.

## Source of truth

* **Database (Prisma)**: `User.role`, `User.isPatron`, `PatronGrant`, `Payment`, `UserPaymentTotal`, `Creator`, `Video`, and `Subscription` are the durable source of truth.
* **Clerk**: Authentication source and metadata sync/cache layer. Clerk metadata must not override database patron decisions.
* **Stripe webhook**: Final authority for payment lifecycle events.
* **API Gateway**: `/api/media/:videoId` is the only path to gated video content.
* **Subscription records**: Source of truth only for email notifications / channel follow state.

## Important modules

* `lib/access/access-policy.ts`: Central content access policy. Uses `User.isPatron` for `PATRON` access.
* `lib/services/payment.service.ts`: Stripe payment/refund/dispute fulfillment.
* `lib/services/user-access.service.ts`: Patron recalculation and Clerk sync.
* `lib/services/content.service.ts`: Public data fetching and DTO mapping.
* `lib/rate-limit.ts`: Shared memory/Upstash/Vercel KV-backed limiter. Production requires writable Redis/KV REST credentials.
* `lib/env/validation.ts`: Central env validation for dev/test/prod; production validation requires DB URLs, auth/payment/email secrets, `MAIN_CREATOR_SLUG`, media allowlist, and writable rate-limit storage.
* `app/api/subscriptions/route.ts`: Email notification follow/unfollow endpoint. It must remain decoupled from Patron access.

## Release automation

`.github/workflows/ci.yml` contains:

* `quality`: install, env validation, Prisma validate/generate, typecheck, unit tests, lint, build.
* `integration-postgres`: Postgres service, `prisma migrate deploy`, Prisma generate, `db:smoke`.
* `security`: `npm audit --audit-level=high` as a non-blocking signal until vulnerability policy is finalized.
