# Architecture

## Current product mode

Polutek.pl is a **strict single-channel VOD** using the legacy `Creator` database model as the main channel record. `MAIN_CREATOR_SLUG` is the dynamic source for the configured main channel; code should not add new hardcoded creator/channel slugs as technical fallbacks. Multi-creator marketplace is not supported.

## Modular Monolith Patterns

The application is transitioning to a modular monolith architecture. Business logic is being organized into domain modules located in `lib/modules/**`.

### Layered Flow
Each request should follow this path:
`Route Handler / Server Action` (Entry) -> `Use Case` (Application) -> `Policy / Service / Repository` (Domain/Infrastructure) -> `Prisma` (Persistence)

### Module Rules
1. **HTTP Independence**: Code inside `lib/modules/**` must not depend on Next.js-specific objects like `Request`, `Response`, `cookies()`, or `headers()`. It should be pure logic that could run in any environment.
2. **Transaction Ownership**: Database transactions belong to the **Use Case** level in the `application` layer of a module. This ensures atomic operations across multiple repository calls.
3. **Public API (The `index.ts` Gate)**: Each module must expose its public API (types, functions, use-cases) through a top-level `index.ts`. Other modules or layers must only import from the module's root (e.g., `@/lib/modules/channel`).
4. **Thin Entry Points**: Route handlers and server actions are strictly entry points. They extract parameters, call a use-case, and format the output. No business logic is allowed here.
5. **Deprecated Services**: Global services in `lib/services/**` are considered legacy. They are sources for migration and must not be used as patterns for new development.

## Main flows

* **Public video playback**: Served through `/api/media/:videoId` for `PUBLIC` videos, with media-host allowlist checks and range-request support.
* **Logged-in video playback**: Requires a Clerk-authenticated session for `LOGGED_IN` videos.
* **Patron video playback**: Requires `User.isPatron` in the database for `PATRON` videos. `Subscription` records must not grant premium access.
* **Donation to Patron**: Stripe checkout/webhooks create payments and patron grants. Refund/dispute handling recalculates net totals and patron status.
* **Referral to Patron**: Referral grants are represented through `PatronGrant` and synchronized through user access services.
* **Channel subscription / follow**: `/api/subscriptions` is an email-notification opt-in/out for the main channel. It is authenticated, resolves the main channel server-side, is rate-limited, and writes only `Subscription` rows.
* **Admin video/channel management**: Restricted to `ADMIN` role and protected at API/service boundaries, not just UI. All management actions are strictly scoped to the main channel.

## Source of truth

* **Database (Prisma)**: `User.role`, `User.isPatron`, `PatronGrant`, `Payment`, `UserPaymentTotal`, `Creator`, `Video`, and `Subscription` are the durable source of truth. `Creator` is the legacy database representation of the single `MainChannel`.
* **Clerk**: Authentication source and metadata sync/cache layer. Clerk metadata must not override database patron decisions.
* **Stripe webhook**: Final authority for payment lifecycle events.
* **API Gateway**: `/api/media/:videoId` is the only path to gated video content. Admin-provided HLS/DASH manifest URLs (.m3u8, .mpd) may be returned only after the same access policy authorizes the viewer and the source URL has passed configured media-host allowlist validation before storage.
* **Subscription records**: Source of truth only for email notifications / channel follow state.

## Robustness Patterns

* **Atomic Webhook Locking**: Clerk and Stripe webhooks use atomic database creation and conditional updates to prevent race conditions during concurrent event delivery.
* **Compare-And-Swap (CAS)**: Financial updates (refunds, totals) use the CAS pattern to ensure state transitions are monotonic and idempotent.
* **Idempotent Checkout**: Client-provided `requestId` is used as a Stripe `idempotencyKey` and database deduplication key for payment intent creation.

## Important modules

* `lib/modules/`: New home for domain-driven logic.
* `lib/access/access-policy.ts`: Central content access policy. Uses `User.isPatron` for `PATRON` access.
* `lib/rate-limit.ts`: Shared memory/Upstash/Vercel KV-backed limiter. Production requires writable Redis/KV REST credentials.
* `lib/env/validation.ts`: Central env validation for dev/test/prod.

## Release automation

`.github/workflows/ci.yml` uses the repository `.nvmrc` so CI follows the same Node 22 runtime declared in `package.json#engines`. It contains:

* `quality`: install, env validation, Prisma validate/generate, typecheck, unit tests, lint, build.
* `integration-postgres`: Postgres service, `prisma migrate deploy`, Prisma generate, `db:smoke`.
* `security`: `npm audit --audit-level=high` as a non-blocking signal until vulnerability policy is finalized.
