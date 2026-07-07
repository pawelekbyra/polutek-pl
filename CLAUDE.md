# CLAUDE.md — AI Agent Guide for Polutek.pl

This file is the primary entry point for AI agents working on this codebase. Read it in full before touching any code.

The full product documentation index lives at `docs/README.md` (architecture, specs, runbooks, audits, ticket queue). Historical multi-agent process docs were retired 2026-07-02 — do not recreate reconciliation reports, roadmaps, or role protocols; durable conclusions belong here, in `KNOWN_LIMITATIONS.md`, or in `docs/audit/`.

**Maintenance rule:** When you add a meaningful new feature, change a critical invariant, introduce a new module, or rename a key file, update this document. Future agents depend on it being accurate.

---

## 0. Current State for Agents

Runtime foundations are stabilized around the current invariants in §4: `PatronGrant` is the source of truth, legacy `User.isPatron` cache fields no longer exist, payment success must route through `fulfillPayment()`, and denied playback plans must not expose playable URLs, tokens, provider IDs, or mounted players.

Do not infer launch readiness from green CI or documentation alone. Public launch still depends on owner/legal/operator evidence, production smoke proof, and the final launch decision tracked outside the executable coding queue, especially GitHub issue #1269.

The executable coding queue is `docs/tickets/ready/`. If a GitHub issue or doc says work is still open but the code/schema/docs already prove it is done, update or close that issue instead of re-implementing old work.

Current UI/runtime baseline as of the 2026-07-04 reconciliation:

- Next.js 15 App Router is the framework target.
- Clerk remains the identity backend, but public auth/account UI is custom/headless (`AuthModalProvider`, `AuthModal`, `UserMenu`, `AccountModal`) rather than default Clerk widgets.
- Public entry is a progressive app shell. Do not reintroduce a blocking splash/ENTER gate.
- Video switching uses a local CSS fade/slide around the player area. Do not reintroduce fullscreen iris/wipe transitions.
- `AppPreloadProvider` warms playback plans, posters and comments on intent. Keep this in-memory; do not add persistent service-worker caching without a cache-safety design.
- `InstallAppMenu` provides install/add-to-home-screen affordances where the browser/platform supports them.
- The legacy paper/ink/rare-blue hand-drawn (rough.js `Frame`, Kalam/Patrick Hand fonts) visual system in `app/globals.css` still exists and is still used by non-homepage surfaces (auth modals, admin, comments internals, legal pages, etc.) — do not remove those tokens/utility classes.
- The homepage channel surface (`Navbar.tsx`, `Hero.tsx`, `ChannelHome.tsx`, `SidebarPlaylist.tsx`, `DonationBox.tsx`/`DonationAmountField.tsx`, `AccessLockOverlay.tsx`, `Footer.tsx`, plus the `flat`/`editorial`-scheme paths of `SubscribeButton.tsx`/`ShareButton.tsx`/`InstallAppMenu.tsx`) uses a separate flat, card-based, blue-accent (`#2563EB`) design skin — Space Grotesk (`font-brand`) headings, Plus Jakarta Sans (`font-sans`) body, one uniform page background (`--chan-nav`) shared by Navbar/content/Footer (no floating card / no separate dark canvas — that was tried and reverted per owner feedback). Do not reintroduce the hand-drawn `Frame`/rough.js borders or paper tokens into these files. `.comments-flat-shell` (globals.css) re-skins the shared comments module for this surface the same way `.comments-paper-shell` does for the paper skin — keep both in sync if the comments module's DOM structure changes.
- `/testujemy` (`app/testujemy/page.tsx`) is an experimental, `noindex` route that renders the exact same `Navbar`/`ChannelHome`/`Footer` tree and data-fetching as the real homepage, wrapped in a `.testujemy-page` CSS scope (`app/globals.css`) that redefines the `--chan-*` tokens plus a short list of hardcoded-hex overrides (`#2563EB`/`#2563eb`/`#EFF3FE`/the login-lock gradient) into an elegant "maison française" cream/bordeaux/gold palette with serif (`font-brand`) headings. No component logic is duplicated — it is a pure CSS re-skin of the real components. If a future edit to those homepage files hardcodes a *new* literal hex color instead of a `--chan-*` token, add a matching override to the `.testujemy-page` block or that spot will silently stay blue on `/testujemy`.

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
| Framework | Next.js 15 App Router (deployed on Vercel) |
| Database | Neon PostgreSQL via Prisma ORM |
| Auth/Identity | Clerk identity backend with custom/headless app UI — NOT patron authority |
| Payments | Stripe (webhooks → fulfillPayment → PatronGrant) |
| Video delivery | Cloudflare Stream primary; Mux/YouTube/Vimeo foundation exists where supported |
| Email | Resend |
| Storage | Vercel Blob legacy thumbnails/media; Cloudflare R2 planned/current migration target |
| Rate limiting | Upstash Redis / Vercel KV |
| Crons | Vercel Crons (`vercel.json` `crons` array) |
| UI | Tailwind CSS + shadcn/ui + paper/ink token utilities in `app/globals.css` |
| Tests | Vitest; Playwright scaffolding for E2E smoke where browsers/env are available |

---

## 3. Module Map

```txt
lib/modules/
  access/           # Video access policy (checkVideoAccess, PlaybackPlan)
  audit/            # Audit event recording
  channel/          # Home/channel content loading
  email/            # Email repository, broadcast use cases, Resend adapter
  media/            # Thumbnail resolution, storage (S3/R2 presigned URLs), thumbnail HTTP response
  patron/
    application/    # grant-patron, revoke-patron, recalculate-patron-status use cases
    domain/         # patron DTOs, errors, policy
    infrastructure/ # PatronRepository (listActiveGrants, createGrant, revokeActiveGrants…)
  payments/         # Payment recording, fulfillPayment (canonical replay-safe path)
  playback/
    application/    # playback.service — resolves playable sources for a video
    domain/         # playback DTOs, playback policy, primary playable asset
    infrastructure/ # cloudflare signed playback token service
  users/
    application/    # admin user details, patron read model, sync-user use cases
    domain/         # user DTOs, errors, policies
    infrastructure/ # UserRepository
  shared/           # AppContext, Actor, result types, db helpers

app/                # Next.js App Router pages and API routes
app/components/     # Public app shell, player, auth UI, comments, preload and channel UI
app/api/            # API routes
app/admin/          # Admin panel pages and components
app/api/admin/      # Admin API routes
app/api/cron/       # Vercel Cron handlers (auth via CRON_SECRET bearer token)
app/api/media/      # Media proxy — only safe playback path for blob/legacy video
app/api/webhooks/   # Stripe, Clerk, Resend, Cloudflare/Mux webhook handlers

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
- DTO/UI fields named `isPatron` may exist only as derived/decorative values computed from grants or admin role.

### 4.2 Patron Grant Lifecycle

```txt
Stripe webhook (signature verified)
  → record StripeEvent
  → record Payment (financial fact)
  → Patron eligibility policy (amount ≥ threshold)
  → fulfillPayment() — canonical, replay-safe
      → creates PatronGrant
      → syncs Clerk metadata (cache only)
      → sends confirmation email
```

`fulfillPayment()` in `lib/modules/payments/` is idempotent and replay-safe. Always use it for payment fulfillment, never issue manual `updateMany({ status: 'SUCCEEDED' })` shortcuts.

### 4.3 Video Playback Security

- **Never expose `videoUrl` to the public frontend.** Use `PublicVideoDTO` for all public-facing data.
- `/api/media/[...path]` is the only public playback path for blob/legacy videos.
- `PlaybackPlan` from the access module gates all player mounting: `READY` → mount player, any denied state → locked placeholder.
- Never mount a player, fetch streams, request tokens, resolve provider playback, or log views for a denied plan.
- `isLegacyPrivatePlaybackFallbackAllowed()` from `lib/modules/playback/domain/playback-policy.ts` always returns `false` — do not bypass it or check `ALLOW_LEGACY_PRIVATE_FALLBACK` env directly.
- **Never CDN-cache `/api/media-source` responses** (no `s-maxage`/`public` Cache-Control). The response carries a per-viewer `playbackSessionId` bound to the requester fingerprint.

### 4.4 Access Checks

Access is checked via `checkVideoAccess()` in `lib/modules/access/`. It reads `PatronGrant`, not `User.isPatron`. Actor type comes from `getActorFromAuth()`.

### 4.5 Clerk Is Identity Only

Clerk provides user identity (userId, email, name). It does not control patron access. Clerk metadata is a sync cache/UI hint — the database is always authoritative.

### 4.6 Email Audience

`lib/modules/email/infrastructure/email.repository.ts` filters patron audience via `patronGrants: { some: { revokedAt: null } }`. Do not filter by `User.isPatron`.

### 4.7 Video Subtitle Tracks

- `Video.subtitleUrlPl` and `Video.subtitleUrlEn` are optional URL fields for WebVTT subtitle files.
- The playback service builds `textTracks` in the `PlaybackPlan.player` from these fields automatically.
- Set them via the admin video create/edit form or API. The `VideoPlayer` component consumes `textTracks`.
- Managed subtitle upload/validation/hosting is not complete; see issue #1219 before expanding this.

### 4.8 Thumbnail Display Path

- All video thumbnails are served through `/api/videos/[id]/thumbnail`, which streams the blob/server-side source and enforces its own policy: published videos are public, drafts are admin-only.
- The route is listed as **public** in `middleware.ts` — do not remove it from `isPublicRoute`.
- Admin components render this proxy with `unoptimized` on `next/image` so draft thumbnails stay visible in the panel with admin cookies.
- `resolveVideoThumbnailUrl()` returns the raw storage/external URL for server-side streaming — never a relative proxy path.
- Published-video thumbnails are CDN-cacheable (`PUBLIC_THUMBNAIL_CACHE_CONTROL`, includes `s-maxage`); draft thumbnails must always use `PRIVATE_THUMBNAIL_CACHE_CONTROL`.
- Planned: custom thumbnail storage moves from Vercel Blob to Cloudflare R2 (free egress) — see `docs/tickets/ready/MEDIA-THUMBNAILS-R2-MIGRATION-001.md`.

### 4.9 Comment Reactions

- `CommentReactionType` enum is `LIKE | DISLIKE` (one reaction per user per comment via `@@unique([userId, commentId])`).
- Dislike has **no public counter** — only `likesCount` is aggregated; deleting/replacing a DISLIKE must never touch `likesCount`.
- `toggleCommentLike` handles `LIKE`/`DISLIKE`/`UNLIKE` (clear). API: `PUT /api/comments/[id]/reaction` with optional body `{ type: "LIKE" | "DISLIKE" }`, `DELETE` clears any reaction.

### 4.10 Donation/Tip Widget — Two Copy Variants, One Payment Path

`app/components/channel/DonationBox.tsx` is the single tip widget rendered by `SidebarPlaylist.tsx`'s `PatronBox`. It renders two copy/threshold variants depending on `viewerIsPatron`, computed from `userProfile?.isPatronDecorative` / admin role and threaded through `SidebarPlaylist`.

- **Non-patron viewer** (`viewerIsPatron` false/undefined): copy promises that a successful tip grants lifetime Thank You Zone access. The amount is fixed to the patron threshold.
- **Existing patron** (`viewerIsPatron` true): copy states access is already secured and this tip unlocks nothing new — free-form additional support. The minimum is `patronBoxMinimums` from `/api/payment-settings`.
- `PatronBox` only renders for **signed-in** users. The render gate uses Clerk's live client auth (`useAuth().isSignedIn`) in `SidebarPlaylist.tsx`, not the server-threaded `userProfile` prop.

Three distinct per-currency minimums must not be conflated:

- **Checkout floor** — `minAmountMinor` / `getPaymentCurrencyLimits()` / `MIN_PAYMENT_BY_CURRENCY`.
- **Patron threshold** — `patronThresholdMinor`, resolved by `resolvePatronThresholdMinor()`.
- **Patron-box minimum** — `patronBoxMinMinor`, the smallest free-form amount an existing patron may tip.

`GET /api/payment-settings` returns all three (`limits`, `patronThresholds`, `patronBoxMinimums`). Stripe Elements render in the viewer's language; keep `DonationBox.tsx` and `CheckoutModal.tsx` copy synchronized.

### 4.11 Language Resolution (pl/en)

- Initial UI language is resolved server-side in `lib/i18n/server-language.ts` (`resolveInitialLanguage()`), called from `app/layout.tsx` and threaded through `Providers` → `LanguageProvider`.
- Priority: signed-in user's DB `User.language` → `app-language` cookie → Vercel geolocation header → `Accept-Language` → `en`.
- `LanguageContext.tsx` mirrors every change to both `localStorage` and a one-year `app-language` cookie.
- Logged-in changes additionally persist to DB via `PATCH /api/user/language` and to Clerk metadata. Transactional/broadcast emails send in stored `User.language`.

### 4.12 Auth UI

- Clerk remains the backend and session authority.
- Public auth/account UI is custom/headless: `AuthModalProvider`, `AuthModal`, `UserMenu`, `AccountModal`, and related OAuth helpers.
- Do not replace the current custom UI with default Clerk widgets unless owner explicitly asks for a rollback.
- Do not implement a custom auth backend; use Clerk headless APIs/hooks.

### 4.13 Public App Shell, Preload and Install UX

- The root public experience should render app shell immediately; no blocking splash/ENTER gate.
- `AppPreloadProvider` is the current in-memory preload layer for playback plans, posters and comments.
- `ServiceWorkerCleanup` disables persistent service-worker interception/caches. Do not add offline/persistent caching for auth, payments, media-source, playback, or user-specific data without a focused design.
- `InstallAppMenu` handles add-to-home-screen/install affordances, including iOS instructions.

### 4.14 What NOT To Do

- Do not recreate retired control-plane docs (`docs/reports`, `docs/roadmap`, `docs/templates`, or governance operating-mode files); durable guidance belongs in this file, `KNOWN_LIMITATIONS.md`, or `docs/audit/`.
- Do not reintroduce legacy patron cache fields on `User` or treat Clerk metadata as patron authority.
- Do not bypass `fulfillPayment()` for Stripe success, replay, or reconciliation flows.
- Do not expose playable video URLs/tokens/provider IDs, mount players, or log views for denied playback plans.
- Do not replace the custom/headless Clerk UI with default widgets or a custom auth backend unless explicitly asked.
- Do not add persistent/offline caches for auth, payments, media-source, playback, or user-specific data without a focused cache-safety design.

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

Default thumbnail fallback priority:

1. `Creator.defaultThumbnailUrl` — URL field set via `/admin/channel`.
2. `AppSetting` key `default_video_thumbnail` — Vercel Blob URL set via `/admin/settings` file upload.
3. `null` — no fallback.

---

## 6. Cron Jobs

Registered in `vercel.json` under `crons`. All cron routes live in `app/api/cron/`. Auth via `Authorization: Bearer <CRON_SECRET>` header.

**Uwaga:** Cron `stripe-reconciliation` został usunięty z `vercel.json`, ponieważ konto Hobby na Vercel nie obsługuje harmonogramów częstszych niż raz dziennie. Trasa API `/api/cron/stripe-reconciliation` nadal istnieje i działa — przy upgrade na plan Pro wystarczy dodać:

```json
{ "path": "/api/cron/stripe-reconciliation", "schedule": "*/15 * * * *" }
```

Co robi ten cron: co 15 minut szuka płatności `PENDING` starszych niż 15 min (do 7 dni) i odpala `fulfillPayment()` ponownie — zabezpieczenie na wypadek utraty webhooka Stripe. Bez crona patron może czekać na dostęp do czasu ręcznej interwencji lub ponownej próby webhooka przez Stripe.

| Route | Schedule (Pro) | Purpose |
|---|---|---|
| `/api/cron/stripe-reconciliation` | `*/15 * * * *` | Recovers stuck `PENDING` payments by re-running `fulfillPayment()` or marking as failed |

---

## 7. Key Files to Know

| File | Role |
|---|---|
| `app/page.tsx` | Public home/channel entry; dynamic page with cached/loaded public content and per-user state |
| `app/components/ChannelHome.tsx` | Public app shell composition, selected video state, local player transition |
| `app/components/preload/AppPreloadProvider.tsx` | In-memory preload/warm layer for playback plans/posters/comments |
| `app/components/VideoPlayer.tsx` | Vidstack player, text tracks, telemetry, custom controls |
| `app/components/PremiumWrapper.tsx` | Access/playback plan fetch and locked/loading states |
| `app/components/auth/AuthModalProvider.tsx` | Custom/headless Clerk modal provider |
| `app/components/auth/AuthModal.tsx` | Custom sign-in/sign-up/password reset UI over Clerk headless APIs |
| `app/components/auth/UserMenu.tsx` / `AccountModal.tsx` | Custom account UI over Clerk user APIs |
| `app/components/channel/SidebarPlaylist.tsx` | Sidebar sections, lock badges, support box signed-in gate |
| `app/components/channel/DonationBox.tsx` | Support/patron tip widget and Stripe checkout entry |
| `app/components/InstallAppMenu.tsx` | Install/add-to-home-screen affordance |
| `lib/modules/patron/application/grant-patron.use-case.ts` | Grant patron status |
| `lib/modules/patron/application/revoke-patron.use-case.ts` | Revoke patron status |
| `lib/modules/patron/application/recalculate-patron-status.use-case.ts` | Pure read — derive status from active grants |
| `lib/modules/payments/application/fulfill-payment.use-case.ts` | Canonical, replay-safe payment fulfillment |
| `lib/modules/access/application/check-video-access.use-case.ts` | Gatekeeper for video access |
| `lib/modules/playback/application/playback.service.ts` | Resolves playable video source based on access plan |
| `lib/modules/playback/domain/playback-policy.ts` | Policy gates for legacy private playback fallback (always false) |
| `app/api/media/[...path]/route.ts` | Media proxy using playback policy |
| `app/api/webhooks/stripe/route.ts` | Stripe webhook handler |
| `app/api/webhooks/cloudflare/route.ts` | Cloudflare Stream webhook handler |
| `lib/modules/users/application/patron-read-model.ts` | Patron diagnostics read model |
| `lib/modules/media/application/default-thumbnail.service.ts` | Resolves fallback thumbnail URL |
| `lib/modules/media/infrastructure/thumbnail-response.service.ts` | Streams thumbnails with correct cache policy |
| `lib/services/payment.service.ts` | Deprecated bridge used only in tests; production uses modular use cases |
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
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob legacy media/thumbnail support |
| `CRON_SECRET` | Authenticates cron API routes (≥32 random chars) |
| `ADMIN_CLERK_USER_IDS` | Comma-separated Clerk user IDs with admin access |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Production rate limiting |

---

## 9. Documentation and Issue Hygiene

- `docs/tickets/ready/` is the only executable file-based ticket queue.
- Legal/operator/evidence scope belongs to issue #1269 unless split into a small implementation ticket.
- Closed/history work belongs in git, PRs and issues, not in living roadmap files.
- If a PR changes behavior that agents must preserve, update this file in the same PR.
- Do not overwrite historical PR bodies unless explicitly asked; update open issues or living docs instead.
