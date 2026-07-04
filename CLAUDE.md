# CLAUDE.md — AI Agent Guide for Polutek.pl

This file is the primary entry point for AI agents working on this codebase. Read it in full before touching any code.

The full product documentation index lives at `docs/README.md` (architecture, specs, runbooks, audits, ticket queue). Historical multi-agent process docs were retired 2026-07-02 — do not recreate reconciliation reports, roadmaps, or role protocols; durable conclusions belong here, in `KNOWN_LIMITATIONS.md`, or in `docs/audit/`.

**Maintenance rule:** When you add a meaningful new feature, change a critical invariant, introduce a new module, or rename a key file, update this document. Future agents depend on it being accurate.

---

## 1. What This Product Is

Polutek.pl is a **single-channel VOD platform** for one creator. It is not a marketplace, not a multi-tenant SaaS, not a subscription service. Core facts:

- One channel, one catalogue of videos, one patron system, one admin cockpit.
- Patron access is a **permanent, lifetime reward** for a qualifying one-time Stripe tip. No recurring subscriptions.
- Videos have three access tiers: `PUBLIC`, `LOGGED_IN`, `PATRON`.
- Comments are visible to all but writing/reacting requires login (PUBLIC/LOGGED_IN videos) or patron status (PATRON videos).

---

## 2. Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router (deployed on Vercel) |
| Database | Neon PostgreSQL via Prisma ORM |
| Auth/Identity | Clerk (identity only — NOT patron authority) |
| Payments | Stripe (webhooks → fulfillPayment → PatronGrant) |
| Video delivery | Cloudflare Stream (primary) |
| Email | Resend |
| Storage | Vercel Blob (legacy thumbnails/media), Cloudflare R2 (future) |
| Rate limiting | Upstash Redis / Vercel KV |
| Crons | Vercel Crons (`vercel.json` `"crons"` array) |
| UI | Tailwind CSS + shadcn/ui components in `components/ui/` |
| Tests | Vitest |

---

## 3. Module Map

```
lib/modules/
  access/           # Video access policy (checkVideoAccess, PlaybackPlan)
  audit/            # Audit event recording
  email/            # Email repository, broadcast use cases, Resend adapter
  media/            # Thumbnail resolution, storage (S3/R2 presigned URLs), thumbnail HTTP response
  patron/
    application/    # grant-patron, revoke-patron, recalculate-patron-status use cases
    domain/         # patron.dto, patron.errors, patron.policy
    infrastructure/ # PatronRepository (listActiveGrants, createGrant, revokeActiveGrants…)
  payments/         # Payment recording, fulfillPayment (canonical replay-safe path)
  playback/
    application/    # playback.service — resolves playable sources for a video
    domain/         # playback.dto, playback-policy, primary-playable-asset
    infrastructure/ # cloudflare-signed-playback-token.service
  users/
    application/    # get-admin-user-details, patron-read-model, sync-user use cases
    domain/         # user DTOs, errors, policies
    infrastructure/ # UserRepository
  shared/           # AppContext, Actor, result types (ok/failure), db helpers

app/                # Next.js App Router pages and API routes
app/api/            # API routes
app/admin/          # Admin panel pages and components
app/api/admin/      # Admin API routes
app/api/cron/       # Vercel Cron handlers (auth via CRON_SECRET bearer token)
app/api/media/      # Media proxy — only safe playback path for blob/legacy video
app/api/webhooks/   # Stripe and Cloudflare webhook handlers

prisma/
  schema.prisma     # Single source of schema truth
  migrations/       # Never edit existing migrations; always add new files
```

---

## 4. Critical Invariants — Read Before Editing

### 4.1 Patron Status Source of Truth

**`PatronGrant` table is the sole source of patron access.** A user is a patron iff:

```prisma
patronGrants: { some: { revokedAt: null } }
```

- `User.isPatron`, `User.patronSince`, `User.patronSource` fields **do not exist** (removed in migration `20260630000000_remove_legacy_user_patron_cache`).
- Never write patron status to the `User` table. Never read it from there.
- `recalculatePatronStatus()` is a pure read — it computes status from active grants, no writes.

### 4.2 Patron Grant Lifecycle

```
Stripe webhook (signature verified)
  → record StripeEvent
  → record Payment (financial fact)
  → Patron eligibility policy (amount ≥ threshold)
  → fulfillPayment() — canonical, replay-safe
      → creates PatronGrant
      → syncs Clerk metadata (cache only)
      → sends confirmation email
```

`fulfillPayment()` in `lib/modules/payments/` is idempotent and replay-safe. Always use it for payment fulfillment, never issue `updateMany({ status: 'SUCCEEDED' })` manually.

### 4.3 Video Playback Security

- **Never expose `videoUrl` to the public frontend.** Use `PublicVideoDTO` for all public-facing data.
- `/api/media/[...path]` is the only public playback path for blob/legacy videos.
- `PlaybackPlan` from the access module gates all player mounting: `READY` → mount player, any denied state → locked placeholder. Never mount a player, fetch streams, request tokens, or log views for a denied plan.
- `isLegacyPrivatePlaybackFallbackAllowed()` from `lib/modules/playback/domain/playback-policy.ts` always returns `false` — do not bypass it or check `ALLOW_LEGACY_PRIVATE_FALLBACK` env directly.
- **Never CDN-cache `/api/media-source` responses** (no `s-maxage`/`public` Cache-Control). The response carries a per-viewer `playbackSessionId` bound to the requester's IP/UA fingerprint; a shared cached copy hands one viewer's session to others and all their playback events fail with 403.

### 4.4 Access Checks

Access is checked via `checkVideoAccess()` in `lib/modules/access/`. It reads `PatronGrant`, not `User.isPatron`. Actor type comes from `getActorFromAuth()`.

### 4.5 Clerk Is Identity Only

Clerk provides user identity (userId, email, name). It does not control patron access. Clerk metadata is a sync cache — the database is always authoritative.

### 4.6 Email Audience

`lib/modules/email/infrastructure/email.repository.ts` filters patron audience via `patronGrants: { some: { revokedAt: null } }`. Do not filter by `User.isPatron`.

### 4.7 Video Subtitle Tracks

- `Video.subtitleUrlPl` and `Video.subtitleUrlEn` are optional URL fields for WebVTT subtitle files.
- The playback service builds `textTracks` in the `PlaybackPlan.player` from these fields automatically.
- Set them via the admin video edit form or API. The `VideoPlayer` component already consumes `textTracks`.

### 4.8 Thumbnail Display Path

- All video thumbnails are served through `/api/videos/[id]/thumbnail`, which streams the blob server-side (private Vercel Blob supported) and enforces its own policy: published videos are public, drafts are admin-only.
- The route is listed as **public** in `middleware.ts` — do not remove it from `isPublicRoute`. The Next image optimizer (`/_next/image`) fetches URLs without auth cookies, so gating the proxy behind Clerk breaks every thumbnail on the site.
- Admin components render this proxy with `unoptimized` on `next/image` (the browser then sends admin cookies directly, so draft thumbnails stay visible in the panel).
- `resolveVideoThumbnailUrl()` returns the raw storage/external URL for server-side streaming — never a relative proxy path.
- Cache policy: published-video thumbnails are CDN-cacheable (`PUBLIC_THUMBNAIL_CACHE_CONTROL`, includes `s-maxage`); draft thumbnails must always use `PRIVATE_THUMBNAIL_CACHE_CONTROL` — a CDN-cached draft thumbnail would leak to anonymous visitors. External origins' Cache-Control headers are ignored on purpose.
- Planned: thumbnail storage moves from Vercel Blob to Cloudflare R2 (free egress) — see `docs/tickets/ready/MEDIA-THUMBNAILS-R2-MIGRATION-001.md`.
- The default-thumbnail preview in `/admin/settings` uses `/api/admin/settings/media/default-video-thumbnail/proxy` (admin-only streaming route).

### 4.9 Comment Reactions

- `CommentReactionType` enum is `LIKE | DISLIKE` (one reaction per user per comment via `@@unique([userId, commentId])`).
- Dislike has **no public counter** — only `likesCount` is aggregated; deleting/replacing a DISLIKE must never touch `likesCount`.
- `toggleCommentLike` use case handles `LIKE`/`DISLIKE`/`UNLIKE` (clear). API: `PUT /api/comments/[id]/reaction` with optional body `{ type: "LIKE" | "DISLIKE" }` (no body = LIKE), `DELETE` clears any reaction.

### 4.10 Donation/Tip Widget — Two Copy Variants, One Payment Path

`app/components/channel/DonationBox.tsx` is the single tip widget (rendered via `SidebarPlaylist.tsx`'s `PatronBox`), but it renders **two different copy/threshold variants** depending on the `viewerIsPatron` prop (already computed in `ChannelHome.tsx` from `userProfile?.isPatronDecorative` / `role === 'ADMIN'`, threaded through `SidebarPlaylist`):

- **Non-patron viewer** (`viewerIsPatron` false/undefined): copy promises that a successful tip grants lifetime Thank You Zone access. The amount is therefore **fixed** to the patron threshold — a non-patron can never submit an amount that would take payment without crossing the patron eligibility threshold, or the "this grants access" copy becomes false. A currency switcher lets them pick the currency (each currency has its own admin-configured threshold, not a conversion).
- **Existing patron** (`viewerIsPatron` true): copy explicitly states access is already secured and this tip unlocks nothing new — free-form additional support. The input minimum is the **patron-box minimum** (`/api/payment-settings` → `patronBoxMinimums`), a value independent of the patron threshold.

`PatronBox` only renders for **signed-in** users (gated on `userProfile` in `SidebarPlaylist.tsx`) — logged-out visitors never see the tip widget.

Three distinct per-currency minimums are involved and must not be conflated (all admin-editable at `/admin/payments`, stored on `PaymentCurrencySetting`):
- **Checkout floor** — `minAmountMinor` / `getPaymentCurrencyLimits()` / `MIN_PAYMENT_BY_CURRENCY`, the smallest amount Stripe/the checkout will accept at all.
- **Patron threshold** — `patronThresholdMinor`, resolved by `resolvePatronThresholdMinor()` (admin value → `PATRON_MIN_TIP_AMOUNT` env fallback → floor). The amount a tip must reach to grant a `PatronGrant`; also the fixed non-patron amount. `fulfillPayment()` uses `getPaymentCurrencyLimits()[currency].patronThresholdMinor` so UI and granting stay in lockstep.
- **Patron-box minimum** — `patronBoxMinMinor`, the smallest free-form amount an existing patron may tip. Falls back to the checkout floor when unset.

`GET /api/payment-settings` returns all three (`limits`, `patronThresholds`, `patronBoxMinimums`) so the client can compute the correct minimum for each variant without duplicating the threshold-resolution logic.

Stripe Elements render in the viewer's language (`locale` on `<Elements>` in `CheckoutModal.tsx`). The left column of `app/components/playlist/CheckoutModal.tsx` (desktop payment modal) carries matching copy for the same reason — keep it in sync with `DonationBox.tsx` when either changes.

### 4.11 Language Resolution (pl/en)

- Initial UI language is resolved **server-side** in `lib/i18n/server-language.ts` (`resolveInitialLanguage()`), called from `app/layout.tsx` and threaded through `Providers` → `LanguageProvider`. Priority: signed-in user's DB `User.language` → `app-language` cookie → Vercel geolocation header (`x-vercel-ip-country`) → `Accept-Language` → `en`. This makes the first paint correct with no hydration flash.
- `LanguageContext.tsx` seeds state from that server value (never a lazy localStorage initializer) and mirrors every change to **both** `localStorage` and a one-year `app-language` cookie, so a logged-out choice survives reloads and stays consistent with SSR.
- Logged-in changes additionally persist to the database via `PATCH /api/user/language` (authoritative on next load) and to Clerk metadata. Transactional and broadcast emails send in the recipient's stored `User.language`.

---

## 5. Admin Panel

Located in `app/admin/`. Key areas:

| Path | Purpose |
|---|---|
| `/admin` | Dashboard overview |
| `/admin/videos` | Video list with filters (`VideoTable`, `VideoFilters`) |
| `/admin/videos/[id]` | Video detail (media, diagnostics) |
| `/admin/videos/[id]/edit` | Metadata edit form |
| `/admin/videos/new` | Create video (Cloudflare upload or existing UID) |
| `/admin/users` | User list |
| `/admin/users/[id]` | User detail + patron diagnostics |
| `/admin/comments` | Comment moderation + reports link |
| `/admin/comments/reports` | Reported comments queue |
| `/admin/emails` | Email broadcast |
| `/admin/channel` | Channel settings (name, bio, banner, default thumbnail URL) |
| `/admin/settings` | Media settings (default thumbnail file upload via Vercel Blob) |

`AdminLayoutShell` wraps all admin pages. `AdminNavigation` provides breadcrumb back-navigation.

### Default Thumbnail Resolution

`lib/modules/media/application/default-thumbnail.service.ts` resolves the fallback thumbnail with this priority:

1. `Creator.defaultThumbnailUrl` — URL field set via `/admin/channel`. Direct URL, no proxy.
2. `AppSetting` key `default_video_thumbnail` — Vercel Blob URL set via `/admin/settings` file upload.
3. `null` — no fallback.

---

## 6. Cron Jobs

Registered in `vercel.json` under `"crons"`. All cron routes live in `app/api/cron/`. Auth via `Authorization: Bearer <CRON_SECRET>` header.

**Uwaga:** Cron `stripe-reconciliation` został usunięty z `vercel.json` ponieważ konto Hobby na Vercel nie obsługuje harmonogramów częstszych niż raz dziennie (wyrażenie `*/15 * * * *` blokuje deployment). Trasa API `/api/cron/stripe-reconciliation` nadal istnieje i działa — przy upgrade na plan Pro wystarczy dodać poniższy wpis z powrotem do `vercel.json`:

```json
{ "path": "/api/cron/stripe-reconciliation", "schedule": "*/15 * * * *" }
```

Co robi ten cron: co 15 minut szuka płatności `PENDING` starszych niż 15 min (do 7 dni) i odpala `fulfillPayment()` ponownie — zabezpieczenie na wypadek utraty webhooka Stripe. Bez crona patron może czekać na dostęp do czasu ręcznej interwencji lub ponownej próby webhooka przez Stripe.

| Route | Schedule (Pro) | Purpose |
|---|---|---|
| `/api/cron/stripe-reconciliation` | `*/15 * * * *` | Recovers PENDING payments stuck 15min–7d by re-running `fulfillPayment()` or marking as FAILED |

---

## 7. Key Files to Know

| File | Role |
|---|---|
| `lib/modules/patron/application/grant-patron.use-case.ts` | Grant patron status (admin/system only) |
| `lib/modules/patron/application/revoke-patron.use-case.ts` | Revoke patron status |
| `lib/modules/patron/application/recalculate-patron-status.use-case.ts` | Pure read — derive status from active grants |
| `lib/modules/payments/application/fulfill-payment.use-case.ts` | Canonical, replay-safe payment fulfillment |
| `lib/modules/access/application/check-video-access.use-case.ts` | Gate keeper for video access |
| `lib/modules/playback/domain/playback-policy.ts` | Always returns false; controls legacy blob playback |
| `app/api/media/[...path]/route.ts` | Media proxy (uses the policy above) |
| `app/api/webhooks/stripe/route.ts` | Stripe webhook handler |
| `app/api/webhooks/cloudflare/route.ts` | Cloudflare Stream webhook handler |
| `lib/modules/users/application/patron-read-model.ts` | `buildPatronDiagnosticsReadModel(grants[])` — diagnostics only |
| `lib/modules/media/application/default-thumbnail.service.ts` | Resolves fallback thumbnail URL (Creator.defaultThumbnailUrl → AppSetting blob) |
| `lib/modules/media/infrastructure/thumbnail-response.service.ts` | Fetches thumbnail blob and returns HTTP response with proper caching headers |
| `lib/modules/playback/application/playback.service.ts` | Resolves playable video source (Cloudflare/Mux/YouTube/legacy) based on access plan |
| `lib/modules/playback/domain/playback-policy.ts` | Policy gates for legacy private playback fallback (always returns false) |
| `lib/services/payment.service.ts` | Deprecated bridge — exports `PaymentService.handleWebhook` used only in tests; production uses `handleStripeWebhook` use case |
| `prisma/schema.prisma` | Database schema (single-writer) |

---

## 8. Environment Variables

See `.env.example` for all variables. Critical ones:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Auth |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon PostgreSQL |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_WEBHOOK_SECRET` | Cloudflare Stream |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (legacy media) |
| `CRON_SECRET` | Authenticates cron API routes (≥32 random chars) |
| `ADMIN_CLERK_USER_IDS` | Comma-separated Clerk user IDs with admin access |
| `MAIN_CREATOR_SLUG` | Required; identifies the single channel |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting (required in production) |
| `MEDIA_BUCKET_HOST` / `NEXT_PUBLIC_R2_PUBLIC_HOST` | Allowlisted media hosts |
| `ALLOWED_THUMBNAIL_HOSTS` | Comma-separated allowed thumbnail image hosts |
| `PATRON_MIN_TIP_AMOUNT` / `PATRON_MIN_TIP_CURRENCY` | Patron qualification threshold |
| `HEALTHCHECK_TOKEN` | `/api/health` auth |
| `EMAIL_UNSUBSCRIBE_SIGNING_SECRET` | Signs unsubscribe tokens |

---

## 9. Testing

Tests live in `tests/unit/`. Run with:

```bash
npx vitest run
```

Key test areas:
- `tests/unit/modules/patron/` — grant, revoke, recalculate, repository logic
- `tests/unit/modules/users/patron-read-model.test.ts` — `buildPatronDiagnosticsReadModel`
- `tests/unit/api/media-proxy-route.test.ts` — media proxy security
- `tests/unit/media-source-safety.test.ts` — playback plan safety

Typecheck:
```bash
npx tsc --noEmit
```

---

## 10. What NOT To Do

- Do not write to `User.isPatron`, `User.patronSince`, or `User.patronSource` — these fields do not exist.
- Do not read patron status from Clerk metadata as an access gate.
- Do not expose `videoUrl` in any public-facing API response.
- Do not mount a video player without a `READY` PlaybackPlan.
- Do not manually set payment status to `SUCCEEDED` — always go through `fulfillPayment()`.
- Do not check `process.env.ALLOW_LEGACY_PRIVATE_FALLBACK` directly; use the policy function.
- Do not add new cron jobs without registering them in `vercel.json`.
- Do not create new database migrations by editing existing migration files.
- Do not add multi-channel, multi-creator, or SaaS-style features.
- **Do not re-introduce default Clerk UI** (`<SignInButton>`, `<SignUpButton>`, `<UserButton>`, `openSignIn()`, the Clerk account portal, "Secured by Clerk"). We are actively replacing all Clerk UI with our own design-system components while keeping Clerk as the backend (headless hooks only). Use `useAuthModal()` to open the custom auth modal. See **`docs/tickets/active/CLERK-CUSTOM-AUTH-UI-001.md`** for scope, phases, and current status before touching anything auth-related.

---

## 11. Documentation Maintenance

When you make a change that materially affects how agents navigate this codebase — a new module, a renamed canonical pattern, a removed invariant, a new cron, a new critical env var, a new mandatory security rule — update this file in the same PR. Stale documentation misleads future agents and creates silent bugs.
