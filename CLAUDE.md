# CLAUDE.md — AI Agent Guide for Polutek.pl

This file is the primary entry point for AI agents working on this codebase. Read it in full before touching any code.

The full product documentation index lives at `docs/README.md` (architecture, specs, runbooks, audits, ticket queue). Historical multi-agent process docs were retired 2026-07-02 — do not recreate reconciliation reports, roadmaps, or role protocols; durable conclusions belong here, in `KNOWN_LIMITATIONS.md`, or in `docs/audit/`.

**Maintenance rule:** When you add a meaningful new feature, change a critical invariant, introduce a new module, or rename a key file, update this document. Future agents depend on it being accurate.

---

## 0. Current State for Agents

Runtime foundations are stabilized around the current invariants in §4: `PatronGrant` is the source of truth, legacy `User.isPatron` cache fields no longer exist, payment success must route through `fulfillPayment()`, and denied playback plans must not expose playable URLs, tokens, provider IDs, or mounted players.

Do not infer launch readiness from green CI or documentation alone. Public launch still depends on owner/legal/operator evidence, production smoke proof, and the final launch decision tracked outside the executable coding queue, especially GitHub issue #1269.

The executable coding queue is `docs/tickets/ready/`. If a GitHub issue or doc says work is still open but the code/schema/docs already prove it is done, update or close that issue instead of re-implementing old work.

**Rebrand as of 2026-07-30: POLUTEK.PL → PAWELPERFECT.PL.** The owner-facing brand name, footer mark, legal-document "Administratorem serwisu ... jest" owner line, PWA manifest `name`/`short_name`, page-title/metadata fallbacks, the `APP_NAME`/`APP_DOMAIN` constants in `lib/constants.ts`, and the transactional-email `from` fallback in `legacy-email-service-provider.ts` were all updated to PAWELPERFECT.PL. Deliberately left untouched, and why:
- `MAIN_CREATOR_SLUG`'s `'polutek'` fallback (`lib/constants.ts`, `prisma/seed.ts`) — this is a database lookup key (a real `Creator.slug` row), not display text; renaming the code fallback without renaming the actual DB row would break the public home page if the real `MAIN_CREATOR_SLUG` env var were ever unset. Only touch this together with an actual DB migration.
- The Clerk/CSP hostnames in `lib/utils/security.ts` (`clerk.polutek.pl`, `accounts.polutek.pl`, `polutek.pl`, `*.polutek.pl`) — these are real DNS/Clerk custom-domain entries. Removing them from the CSP allow-list before Clerk's custom domain is actually migrated to the new domain would break production login immediately. **Update 2026-07-31:** `generateCSP()`'s `clerkDomains` list is no longer purely static — `getConfiguredAppHosts()` derives host entries from `NEXT_PUBLIC_APP_URL` (adding `clerk.<host>`, `accounts.<host>`, `<host>`, `*.<host>`) and always includes both `polutek.pl` and `pawelperfect.pl` as static fallbacks, so a Clerk custom-domain cutover to pawelperfect.pl can't get silently CSP-blocked by this file being stale again. Keep both domains present until the `polutek.pl` alias is fully retired in Vercel/Clerk; do not narrow this back down to a single domain without confirming the old alias is gone. New admin diagnostic endpoint: `GET /api/admin/health/clerk` (admin-only, mirrors the `admin/health/cloudflare` pattern) decodes `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`'s embedded Frontend API host, flags a mismatch against `NEXT_PUBLIC_APP_URL`'s domain, checks whether that host is present in the live CSP, and (with `?probe=network`) does a live reachability check against it — use this first when Clerk UI silently fails to render after a domain change, since a stale publishable/secret key pair encoding the old domain is the most common cause and won't show up as a normal error.
- Purely internal identifiers with no user-facing surface — CSS/JS hooks like `.polutek-vidstack-player`, `.polutek-watch-nav`, `.polutek-player-loader*`, the `PolutekControls.tsx` component name, and custom event names like `polutek:open-support` — left alone; renaming them is a large mechanical refactor across many files for zero user-visible benefit.
- The GitHub repository name/owner and actual DNS — code changes here don't move the live site. `polutek.pl`/`www.polutek.pl` were still the production Vercel domain aliases as of this rebrand; the real cutover (DNS, `NEXT_PUBLIC_APP_URL`, `EMAIL_FROM`, Clerk custom domain) is an infrastructure task outside this repo.

**Update 2026-08-01:** `LEGAL_OWNER.email` in `LegalDocs.tsx` (the support inbox shown/linked throughout regulamin and polityka-prywatnosci, PL and EN) is now `support@pawelperfect.pl` — owner confirmed the `@pawelperfect.pl` inbox is live and monitored before this change went in. It had been deliberately left on `support@polutek.pl` during the initial rebrand specifically until that inbox existed; that condition is now satisfied.

Current UI/runtime baseline as of 2026-07-14:

- Next.js 16 App Router with React 19 is the framework target.
- Clerk remains the identity backend, but public auth/account UI is custom/headless (`AuthModalProvider`, `AuthModal`, `UserMenu`, `AccountModal`) rather than default Clerk widgets.
- Public entry is a progressive app shell. Do not reintroduce a blocking splash/ENTER gate.
- The root `/` route redirects to a locale. Keep `app/loading.tsx` visually neutral. The home page (`page.tsx`) and its full-channel `HomePageSkeleton` fallback (`loading.tsx`) live under the `app/[locale]/(home)/` route group — not directly in `app/[locale]/` — because a `loading.tsx` placed at a segment applies as an outer Suspense boundary to *every* route nested under that segment, not just its own page. Legal docs, search and other `app/[locale]/*` routes have their own scoped `loading.tsx` (e.g. `LegalDocSkeleton` for `regulamin`/`polityka-prywatnosci`/`terms`/`privacy-policy`); do not add a bare `app/[locale]/loading.tsx` again or it will leak the video/playlist skeleton onto every sibling route. `ChannelHome` likewise reserves comment space before client mount without drawing a second skeleton; `EmbeddedComments` owns the actual comment-loading skeleton.
- Video switching uses a local CSS fade/slide around the player area. Do not reintroduce fullscreen iris/wipe transitions.
- `AppPreloadProvider` warms playback plans, posters and comments on intent. Playback plans are isolated by Clerk viewer/session plus video, stale requests are aborted, and `PremiumWrapper` fails closed unless the current viewer has an explicit `READY + canPlay + access.allowed + source + matching videoId` plan. Keep this cache in-memory; do not weaken its viewer scope or add persistent service-worker caching without a cache-safety design.
- `InstallAppMenu` provides install/add-to-home-screen affordances where the browser/platform supports them. **Update 2026-08-01:** its only mount point (the below-player action rail in `Hero.tsx`) was removed at the owner's request ("usuń przycisk ściągnij"/remove the download button) — the component still exists and works, it's just currently unmounted everywhere. Re-add `<InstallAppMenu />` somewhere if the install affordance needs to come back rather than rebuilding it.
- The public site has one application-grade VOD/PWA direction. Experimental theme/font routes (`/testujemy`, `/cyberpunk*`, `/glass`, `/testowy*`, `/eksperyment*`, `/t*`, `/czcionka*`) and their scoped CSS/assets were removed. Do not recreate parallel skins; prototype by evolving production components and semantic tokens.
- Public typography is self-hosted Geist Sans/Mono from the `geist` package. `font-sans`, `font-heading`, and `font-brand` intentionally resolve to Geist Sans; `font-mono` resolves to Geist Mono. Builds must not fetch remote fonts.
- As of 2026-07-30, the site logo (`app/components/BrandName.tsx`, used by `Navbar.tsx` and `CheckoutSummaryPanel.tsx`) is the glasses/sunglasses graphic `public/logo-glasses.svg` rendered as a plain `<img>` (sized via a caller-supplied `h-*`/`w-auto` className, not `next/image` — a small static local vector gains nothing from the optimizer), replacing the earlier "POLUTEK.PL" text wordmark. `BrandName` no longer has a `shine` prop (it only ever applied to the old text rendering and had already gone unused before this change) — just `className` and `decorative` (`decorative` renders `alt=""` for the case where an enclosing `<Link>` already carries its own `aria-label="POLUTEK.PL"`, avoiding double-announcing the name to screen readers). The Space Grotesk Bold `font-brandLogo`/`--font-brand-logo` font (`app/fonts/space-grotesk-bold-latin.woff2`) that the old text wordmark used is still defined in `app/fonts.ts`/`tailwind.config.ts` but is no longer referenced anywhere — leave the font infra in place unless explicitly asked to remove it, in case the wordmark returns. Logo height is `h-[28px] md:h-[34px]` in the Navbar's `h-[38px]` slot and `h-[36px]` in `CheckoutSummaryPanel`; the mark was sized noticeably smaller on the first pass and read as too small, so don't shrink it back down without checking it still fills most of the navbar slot. The Navbar's sign-in/"ENTER" button (`Navbar.tsx`, `t.signIn`) is a fixed `w-[38px]` icon-only circle below `sm:` (matching the other 38×38 icon buttons already in the navbar, and roughly one language-switcher segment) instead of `px-3.5` padding around a hidden-on-mobile text label, which had made it visibly larger than its neighbors; it only grows to fit the "ENTER" text at `sm:` and up (`sm:w-auto sm:px-4`).
- The public palette uses `--chan-*` tokens: blue (`--chan-blue`) is the primary action/navigation accent, while the vivid yellow-orange amber family (`--chan-amber`, `--chan-amber-bright` and related tokens) is the visible secondary accent for patron/support surfaces and selected warm highlights. Both accents should be recognizable across the public experience without turning every generic action amber. Public surfaces use cool neutral application cards, soft borders, consistent radii and layered ambient shadows. Avoid hard offset “3D” shadows and new literal accent hexes. `NajsIcon` remains unrelated shared icon infrastructure.
- `/secretproject` (locale-routed `app/[locale]/secretproject/`, public in `middleware.ts` as `/secretproject`, `/pl/secretproject`, `/en/secretproject`) is a standalone crowdfunding campaign page ("I raise money for my secret project") with its own scoped dark `--sp-*` theme, topbar and footer in `app/components/secretproject/` — intentionally separate from the `--chan-*` shell. It shows the home pitch video plus the first PATRON-tier video as the locked reward, both mounted only through `PremiumWrapper`/`PlaybackPlan` (all §4.3 invariants apply). Its progress bar is a display-only aggregate of succeeded `Payment` rows converted to PLN with static rates — never a financial record; goal/deadline are constants in the page file. `SecretPledgeBox` reuses the canonical checkout path (`/api/checkout/create-intent` → `CheckoutModal` → Stripe return-URL reconciliation via `GET /api/payments/[id]`, full reload on confirmed success) — do not fork a second payment flow for it.
- `/secretproject2` (locale-routed `app/[locale]/secretproject2/`, public in `middleware.ts` as `/secretproject2`, `/pl/secretproject2`, `/en/secretproject2`) is a second, deliberately different presentation of the **same** underlying Secret Project campaign — a light editorial `--sp2-*` theme in `app/components/secretproject2/` (paper background, single accent color, SVG circular funding ring via framer-motion instead of a CSS progress bar, framer-motion `whileInView` scroll reveals instead of CSS keyframes, a tier-card amount picker in `SecretPledgeBox2` instead of a raw number input) versus `/secretproject`'s dark `--sp-*` treatment. Both pages share funding/viewer/video-selection logic from `lib/modules/campaign/secret-project-funding.ts` (`loadSecretProjectFunding`, `loadSecretProjectViewerIsPatron`, `pickSecretProjectVideos`) so the two page files only own their own campaign display constants (goal/deadline) and presentation — keep those two constants in sync between the page files when the campaign's numbers change. Same invariants as `/secretproject` apply: playback only through `PremiumWrapper`/`PlaybackPlan`, checkout only through the canonical `/api/checkout/create-intent` → `CheckoutModal` → Stripe return-URL reconciliation path, never a forked payment flow.
- The homepage/channel (`Navbar`, `Hero`, `ChannelHome`, `SidebarPlaylist`, comments, support box, player states and footer) is one responsive application shell suited to browser and installed PWA use. The **admin** shell is out of scope and keeps its approved scoped treatment; `/admin/payments` must retain its existing treatment.
- As of 2026-07-30, below the `lg` (1024px) breakpoint the video player is full-bleed edge-to-edge — no rounded corners, no border/card frame, no page gutter — matching the standard mobile video-platform pattern (phones are already narrow, so a decorative frame around the player is wasted space). `Hero.tsx`'s outer wrapper only gains the rounded/bordered/shadowed "application card" treatment at `lg:`; the featured-media `<div>` uses `-mx-4 md:-mx-6 lg:mx-0` to bleed out of the page container's own horizontal gutter on phone/tablet while staying contained in the card on desktop. **That `<div>` must stay at its default `width: auto` — never add `w-full`/a fixed width alongside the negative `-mx-*` margins.** Width and margin are independent in the CSS box model: with a fixed width, a negative margin only *shifts* the box (it shipped once anchored left with a gap on the right, see the 2026-07-30 follow-up fix) instead of stretching it to fill both edges — only `width: auto` lets the browser expand the box into the margin gap on both sides. `watch-actions.module.css`'s player-internal bezel border/outline (the `section:has(.polutek-vidstack-player) > div > div:first-child` selector) is flattened to a plain black edge below 1024px for the same reason — a decorative inner frame reads as a stray box once there's no outer card around it. That same selector also gets a phone-landscape safeguard (`max-width: 1023px and (orientation: landscape) and (max-height: 560px)`): a full-bleed 16:9 box sized from viewport width alone can end up taller than a short landscape viewport, so in that state the player is instead sized from height (`aspect-ratio` + `height: 88vh`) and centered/letterboxed rather than stretched edge-to-edge — don't remove this without re-checking phone landscape. That height is deliberately a plain `vh` value, not `dvh`/`calc()`: a CSS unit the browser doesn't recognize invalidates the *entire* declaration it appears in (silently reverting to the width-driven sizing this rule exists to prevent), so resist the urge to make it more precise with newer viewport units unless you can verify support. The same landscape query also switches `.metaRow` to `flex-direction: row` (creator info and action buttons side-by-side instead of stacked) and `.actionRail` to a plain non-wrapping flex row, since landscape phone widths (600-950px) have room the narrow portrait layout doesn't. As of 2026-07-30 this letterbox/reflow behavior is a secondary fallback only — the primary defense is `app/components/RotateDeviceGuard.tsx`, mounted globally in `app/layout.tsx` (inside `AuthModalProvider`, so `useLanguage()` is available), which blocks the entire view with a full-screen "rotate your phone to portrait" prompt on real phones in landscape rather than trying to reflow around it. It's a pure-CSS `@media` gate in `RotateDeviceGuard.module.css` — `(max-height: 560px) and (min-width: 561px) and ((hover: none) or (pointer: coarse))` — with no JS orientation detection, so it can't lag or miss a rotation event. As of 2026-07-30 this deliberately avoids the `orientation` media feature (some mobile browsers evaluate it against the device/screen orientation-lock state rather than the actual viewport box, which can disagree with what's on screen) in favor of a plain width > height comparison, and uses `(hover: none) or (pointer: coarse)` — not `and` — so a device that misreports just one of the two touch signals still trips the guard; the `max-height: 560px` clause excludes tablets (their landscape height is comfortably above that) and the `min-width: 561px` clause keeps the guard off in portrait. Keep both layers — the guard is what the user actually sees, but the graceful CSS underneath is what's briefly visible if a device's `hover`/`pointer` media features don't match as expected. `public/manifest.json`'s `orientation` is `portrait-primary` (was `any`) so an **installed/standalone PWA session on Android** genuinely locks to portrait at the OS level — the app window never rotates at all, no prompt needed. This is a real platform ceiling, not a gap to keep chasing: iOS Safari has never implemented orientation-lock for web content, standalone or not, so on iPhone (browser tab or installed) physical rotation will always resize the viewport regardless of anything this codebase does, and `RotateDeviceGuard`'s blocking prompt is the actual best available substitute there. The comments panel and the mobile "videos" tab panel in `ChannelHome.tsx` follow the same framing rule: no border/background/shadow/rounded card below `lg` (just a `border-t` divider and vertical padding, relying on the page's own gutter), full card treatment restored at `lg:`. The comments/videos tab switcher above them is a flat full-width underline tab bar (edge-to-edge via the same `-mx-4 md:-mx-6` bleed, each tab `flex-1`, active tab marked by a thin colored bottom bar in `--chan-blue`/`--chan-amber`) rather than a rounded pill segmented control — a full-bleed rounded-full pill reads wrong once stretched edge-to-edge, so don't reintroduce the pill/segmented-control style at full width. Everything else below the player (title, creator row, action buttons, description panel, comments, playlist) keeps the page's normal horizontal gutter — only the player and the tab bar bleed to the edge. The desktop two-column dashboard (`lg:` sidebar `aside`, support box) keeps its existing card framing; this change is mobile/tablet-only.
- Video player controls remain fully custom (`app/components/player/PolutekControls.tsx`) rather than Vidstack's stock layout. `PlayerLoadingState`, `AccessLockOverlay`, `PlayerErrorOverlay` and `PlayerStateFrame` own matching player states. As of 2026-07-14 the full login-required and patron-required locks (`app/components/AccessLockOverlay.tsx` / `.module.css`) are a `var(--chan-ink)`-based "premium dark panel" style, per explicit owner iteration on an earlier near-pure-black (`#0a0a0a`) version that read as too glaring/oversaturated: an animated `.aurora` layer (three independently drifting blurred blobs, deep `--chan-blue` for login, deep `--chan-amber`/`--chan-amber-strong` for patron, all mixed into `--chan-ink` rather than pure black) plus a diagonal `.sheen` gloss sweep and a subtle grain `.noise` overlay behind a centered `Lock`/`Gem` icon, a moderate-weight two-line uppercase headline (white + accent-colored word, `font-weight: 780`, tight but not extreme tracking) matching the site's `font-brand`/Geist Sans premium-editorial voice, a thin divider, and a minimal text-only CTA (thin line + tracked label) that brightens on hover/focus — no card, no button chrome. `AccessLockOverlay.tsx` uses `framer-motion` for a staggered mount choreography (icon spring-in, headline lines fade-up, CTA fades in last); the ambient background motion is driven by CSS `@keyframes` (not framer-motion `repeat: Infinity`) for performance. Compact thumbnail locks use the same premium-dark-panel tone but stay static (no motion, no `.aurora`/`.sheen`) for performance — many can mount at once in `SidebarPlaylist`/`ChannelVideoCard` — with a smaller icon and a two-line-clamped label so longer copy (e.g. "Strefa Fenkju") doesn't get crushed by an oversized icon. All motion must stop under `prefers-reduced-motion` (both the framer-motion entrance and the CSS ambient animation), and denied states must never keep a player mounted for an exit animation. Don't reintroduce the earlier pastel/illustrated ticket-and-thank-you-card design, pure-black/oversaturated glow, or card/button chrome without an explicit request; patron styling remains visible even when a guest must sign in first.

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
| Framework | Next.js 16 App Router + React 19 (deployed on Vercel) |
| Database | Neon PostgreSQL via Prisma ORM |
| Auth/Identity | Clerk identity backend with custom/headless app UI — NOT patron authority |
| Payments | Stripe (webhooks → fulfillPayment → PatronGrant) |
| Video delivery | Cloudflare Stream primary; Mux/YouTube/Vimeo foundation exists where supported |
| Email | Resend |
| Storage | Vercel Blob legacy thumbnails/media; Cloudflare R2 planned/current migration target |
| Rate limiting | Upstash Redis / Vercel KV |
| Crons | Vercel Crons (`vercel.json` `crons` array) |
| UI | Tailwind CSS + shadcn/ui + Geist + semantic `--chan-*` application tokens |
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

**Return-page fast path (added 2026-07-21):** the webhook remains the reliability backbone, but `getOwnedPaymentStatus()` (`lib/modules/payments/application/get-payment-status.use-case.ts`, backing `GET /api/payments/[paymentId]`) no longer only reads the local `Payment.status`. When the caller's own payment (ownership already enforced by the `{ id, userId }` lookup) is still `PENDING` and has a `stripeIntentId`, it retrieves that PaymentIntent directly from Stripe and, if Stripe already reports `succeeded`, calls `fulfillPayment()` right there — the same canonical, replay-safe path, never a manual status write — before responding. This is what lets `DonationBox.tsx`'s post-checkout success screen resolve near-instantly instead of only after the webhook lands; the polling loop there does an immediate check on mount rather than waiting for the first interval tick. Any Stripe/network failure in this path is swallowed and falls back to the normal webhook-driven polling — it is a best-effort fast path, not a new source of truth.

**Return-page message trusts Stripe's redirect signal.** `DonationBox.tsx` reads Stripe's own `redirect_status` off the return URL: `succeeded` (or the param being absent on a plain card confirmation) shows the full thank-you immediately; `failed` shows a red failure header (`CheckoutModal.tsx` renders a red ✕ + "something went wrong" for `FAILED_CANCELED`/`REFUNDED_DISPUTED`); genuinely async `pending`/`processing` methods get a neutral processing screen until the background reconciliation confirms. The reconciliation loop only ever *upgrades* a processing screen to success — it must never downgrade an already-shown success message, and no raw `PaymentUiStatus` enum or "webhook" jargon may reach the UI. Closing the success screen (X or "back to site") after a succeeded payment does a full `window.location` reload to the clean URL so every server-rendered surface (Patron badge, `viewerIsPatron` video locks, support-box copy) comes back reflecting the freshly-granted access at once — do not downgrade this to a soft `router.replace`, which leaves stale non-patron server state and cached playback plans.

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

- **Non-patron viewer** (`viewerIsPatron` false/undefined): copy promises that a successful tip grants lifetime Thank You Zone access.
- **Existing patron** (`viewerIsPatron` true): the "Bramka Napiwkowa" / tip-jar variant — copy states access is already secured and this tip unlocks nothing new.
- `PatronBox` only renders for **signed-in** users. The render gate uses Clerk's live client auth (`useAuth().isSignedIn`) in `SidebarPlaylist.tsx`, not the server-threaded `userProfile` prop.

**Update 2026-08-01:** a prior revision of this section described a separate `TipJarModal.tsx` (steps: disclaimer → recipient picker → channel picker → BLIK/crypto/Stripe) and a patron variant with no amount field/terms checkbox. That multi-channel tip modal was built and then fully reverted (see the "Revert the multi-channel tip modal" commit) — `TipJarModal.tsx` does not exist in the codebase. Both variants now share one card and one button (`onSupport()`, no arguments — reads `amount`/`isTermsAccepted` from component state), both showing the same `DonationAmountField` and terms checkbox regardless of `viewerIsPatron`; only the copy/title/bullets differ. **Do not re-add BLIK/crypto payment channels or a separate tip-jar modal without an explicit request** — if one comes, keep the same rule that mattered before: the Stripe branch must stay on the canonical path (`onSupport()` → `/api/checkout/create-intent` → `CheckoutModal` → return-URL reconciliation → `fulfillPayment()`), and any unverifiable display-only channel (BLIK/crypto) is safe only because it's patron-only and grants nothing.

**Navbar/Hero deep-link into DonationBox.** `Hero.tsx`'s below-player action row has a `supportAction` button (neutral gray, matching Share/like-dislike) that, on click, both dispatches the `polutek:open-support` window event (see the mobile tab handoff note below) and merges `?support=1` into the **current** path/query via `router.replace(`${pathname}?...#donations`, { scroll: false })` — never a duplicated payment flow, and never a bare `${getLocalizedHref(language, "home")}` push. `#donations` is `DonationBox`'s own anchor ID (also used by `AccessLockOverlay`/`CommentComposer`'s own `href="#donations"` links); a `useEffect` in `DonationBox.tsx` detects `?support=1` on mount, then strips the param via `router.replace()` so a refresh doesn't retrigger it. Because `PatronBox` only mounts for signed-in viewers, the button checks auth first and opens the sign-in modal for logged-out clicks instead of navigating somewhere with nothing to trigger.

**Update 2026-08-02:** that `?support=1` effect only calls the box's own `onSupport()` when it would actually proceed to checkout (`userId` present, `isTermsAccepted` already true, valid `amount`) — not unconditionally. `isTermsAccepted` always starts `false` on a fresh mount (no persistence across visits), so calling `onSupport()` unconditionally from the deep-link click made the terms checkbox flag its "accept the terms" error immediately on essentially every Wspieraj click, before the viewer had even seen the box — a real, consistently-reproducible bug, not an edge case. The error must only appear from a real, explicit click on the box's own "Wyślij napiwek"/pay button. The guarded auto-call still fast-paths a repeat tip when everything is already filled in (rare, but harmless); otherwise the deep link is now a no-op beyond revealing/scrolling to the box. Covered by `tests/unit/components/channel/DonationBox-deep-link-terms.test.tsx`, confirmed to fail against the old unconditional `onSupport()` call before this guard landed.

**Update 2026-08-01 (mobile tab handoff):** on mobile/tablet (`ChannelHome.tsx`, below `lg:`), the donation box only exists inside the "videos" tab (`SidebarPlaylist`), not the "comments" tab — so a click on Hero's Wspieraj button while on "comments" must also switch tabs. `ChannelHomeContent` has a `revealDonations()` callback (`useCallback`) that both the pre-existing `polutek:open-support` window event listener (shared by `AccessLockOverlay`'s CTA and Hero's Wspieraj button) calls: `setActiveTab("videos")` on mobile, then a `scrollIntoView`. Hero's button used to only navigate via `?support=1` and rely on a `useSearchParams()`-driven effect in `ChannelHome` to trigger the tab switch — that round-tripped through router/searchParams propagation and proved unreliable from the "comments" tab (the switch and/or scroll intermittently didn't happen). Dispatching the window event directly on click makes the tab-switch+scroll synchronous and independent of any router timing, exactly like the already-proven `AccessLockOverlay` path; the `?support=1` query param is now purely a secondary signal so `DonationBox` can call its own `onSupport()` once it mounts — it is no longer what triggers the tab switch. Before that, Hero's button used to `router.push` a bare `${getLocalizedHref(language, "home")}` URL, which dropped the currently-open video's `?v=` param and forced `ChannelHomeContent`'s route-change reset (back to the "comments" tab) — a full, jarring content swap that looked like a sudden jump rather than a tab change; merging into the current path/query instead keeps `?v=` intact, so only `activeTab` changes.

**Update 2026-08-02 (always-mounted mobile "videos" panel — simplified, replaces two prior overengineered attempts):** two earlier iterations tried to paper over a race where the mobile "videos" tab panel (and the `SidebarPlaylist`/`DonationBox` inside it) was only *conditionally rendered* (`{activeTab === "videos" && (...)}`) — first with a fixed-delay `scrollIntoView` to wait out its slide-in-from-top mount animation, then with a 150ms-interval/~3s-deadline poll to also wait out `SidebarPlaylist`'s own Clerk `authLoaded` check. Both were real races in principle but the added complexity didn't reliably fix the reported behavior in practice and made the code much harder to reason about. The actual fix: the mobile "videos" tab panel is now **always mounted**, hidden via a plain CSS `hidden` class toggle when inactive — exactly the same technique the "comments" panel already used (`activeTab === "videos" && "hidden"`), just applied symmetrically to both panels instead of only one. This means `#donations` exists in the DOM continuously once the viewer is signed in, regardless of which tab is currently showing, so there is nothing to wait for: switching tabs is just a class toggle, and `revealDonations()` is back to a single `setActiveTab("videos")` + one `scrollIntoView` call (no delay, no polling, no slide-in animation on the panel). The wrapper carries `data-testid="mobile-videos-panel"` so tests can assert on the tab's hidden/visible state directly instead of on the DOM node's presence. If a future change reintroduces conditional mounting or a mount animation for this panel, it must re-solve the "target may not exist yet" problem — don't drop the always-mounted approach without a plan for that.

**Update 2026-08-02 (desktop regression — duplicate `#donations` id):** the always-mounted mobile panel above introduced a second bug: at desktop widths, **two** elements share `id="donations"` at once — the mobile "videos" panel's own `DonationBox` (still in the DOM, just CSS-hidden via `lg:hidden`) and the desktop aside's separate `SidebarSupportBox`/`DonationBox`. `document.getElementById` always returns the first match in DOM order — the hidden mobile copy — so on desktop the Wspieraj button's scroll silently targeted a `display:none` element and did nothing (worked fine on mobile, where that copy is the visible one). `getVisibleDonationsElement()` (`ChannelHome.tsx`, module-level) fixes this by querying all `[id="donations"]` matches and picking the one whose `offsetParent` isn't null (browsers null this out for `display:none` elements and their descendants). `revealDonations()` calls this instead of `document.getElementById`. Covered by `tests/unit/components/channel-home-support-handoff.test.tsx`, which mocks both `SidebarPlaylist` and `SidebarSupportBox` to each render their own `#donations` copy and stubs `offsetParent` per test (jsdom does no real layout, so this can't be verified any other way) to assert the scroll lands on whichever copy is actually visible for that viewport — this test was confirmed to fail against the old `document.getElementById` call before the fix landed. If either component's rendering ever changes such that only one `#donations` can exist at a time, this helper becomes unnecessary but remains harmless.

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

**Update 2026-08-02:** `updateAdminVideo()` (`lib/modules/video/application/update-admin-video.use-case.ts`) only re-validates Hero eligibility (`VideoPolicy.getHeroBlockers`, which includes the "must have an active playback route in READY state" check) when the update actually **promotes** a video to Hero (`input.isMainFeatured` true while `existing.isMainFeatured` was false/unset) — not on every save. The `/admin/videos/[id]/edit` form always resubmits the video's current `isMainFeatured` value regardless of what the admin actually changed, so re-validating on every save meant a video that became Hero before the active-playback-route invariant existed (or otherwise has a legacy gap there, e.g. a working `isPrimary` asset with no backfilled `VideoPlaybackRoute` row) could never be edited again — even a trivial title change would fail with `VIDEO_INVALID_HERO: VIDEO_PUBLICATION_MISSING_ACTIVE_ROUTE`, despite the video playing fine on the live site. Covered by a regression test in `tests/unit/modules/video/update-admin-video.use-case.test.ts`, confirmed to fail against the old unconditional check before the guard landed.

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
| `/api/cron/video-provider-jobs/reconcile` | `0 4 * * *` (registered; daily works on Hobby) | Polls provider status for stuck import jobs (missed webhooks), restarts imports that never reached the provider, fails them with a clear reason after max attempts |

The daily cron is only the safety net for video provider jobs. The primary recovery path is on-demand: `POST /api/admin/videos/[id]/reconcile` now runs the provider-job reconciler scoped to that video before route policy, and the admin media panel calls it from the "Odśwież" button plus an automatic 15s poll while the pipeline is in `CREATING_SOURCES`/`PARTIALLY_READY`. Do not revert the media panel to a passive DB-state read — without provider polling, a missed webhook leaves targets in "Tworzę źródło" forever.

---

## 7. Key Files to Know

| File | Role |
|---|---|
| `app/page.tsx` | Root `/` route; resolves locale and redirects to `/[locale]` |
| `app/[locale]/(home)/page.tsx` | Public home/channel entry; dynamic page with cached/loaded public content and per-user state. Route-grouped with its `loading.tsx` so the full `HomePageSkeleton` doesn't leak onto sibling `app/[locale]/*` routes |
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
