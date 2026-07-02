# Full application audit — 2026-07-02

Systematic sweep of all 78 API routes, the middleware allowlist, webhook
handlers, payment/patron flows, playback security, and repo hygiene.
Method: every route's auth enforcement was cross-checked against the
`middleware.ts` public-route allowlist; each webhook was checked for
signature verification; abuse surfaces were checked for rate limiting.

## Verdict

Foundations are sound. One real bug found (email unsubscribe behind the
login wall — fixed in this audit), a handful of operational notes, no
critical security findings.

## PASS — verified controls

| Area | Finding |
|---|---|
| Admin authorization | All 43 `/api/admin/*` routes call `requireAdminForApi` (the one exception is a deprecated alias delegating to a guarded canonical route). Role resolution is DB-authoritative (`User.role === "ADMIN"` or `ADMIN_CLERK_USER_IDS` allowlist), with deleted-user denial. Session claims are never trusted for authorization. |
| Webhooks | All 5 verify signatures before processing: Stripe (`constructEvent`), Clerk (svix), Resend (svix), Cloudflare Stream (HMAC, fails closed when secret unset), Mux (HMAC with `timingSafeEqual`). |
| Cron | `stripe-reconciliation` requires `Bearer CRON_SECRET` and fails closed when the secret is unset. |
| Payments | Checkout requires login by design (patron grant needs an account); the UI opens the sign-in modal for guests before hitting the API. Rate-limited (10/10 min), zod-validated, amounts re-validated server-side. Payment status endpoint checks ownership (`getOwnedPaymentStatus`). Fulfillment is replay-safe (`fulfillPayment`, StripeEvent dedup). |
| Playback | Cloudflare Stream playback uses per-request signed tokens (HLS + iframe). Playback plans gate provider resolution behind the access decision. `media-source` responses are `private, no-store` and carry per-viewer sessions. Playback events: rate-limited, session-fingerprinted, event types validated, metadata sanitized (depth/size caps, secret-shaped keys stripped). YouTube sources are refused for PATRON-tier videos. |
| Comments | Write operations require login and are rate-limited; GET is public by design. Image upload requires login (middleware default). |
| Thumbnails | Published = public + CDN-cacheable; drafts = admin-only + `private` cache (CDN can never leak a draft). External origins' Cache-Control is ignored. |
| Secrets | No committed `.env` or live keys (`git grep` for `sk_live`/`whsec_`/`re_`/AKIA patterns — only the logger's redaction regex and test fixtures match). Logger redacts sensitive value patterns. Diagnostics endpoints are token-protected and report secret *presence/format*, never values. |
| Headers | CSP generated in middleware for every response; security headers in `next.config.mjs`; `x-request-id` correlation on all responses. |

## FIXED in this audit

- **Email unsubscribe was behind the Clerk login wall.** Emails send
  `List-Unsubscribe: </unsubscribe?token=...>` and footer links to the same
  page, and the page posts the signed token to
  `/api/subscriptions/unsubscribe` — but neither route was in the middleware
  public allowlist, so logged-out recipients hit a sign-in redirect (page)
  or 404 (API). Both routes are token-authorized by design (signed HMAC
  token with expiry, generic non-enumerating response) and are now public.
  Same defect class as the `/api/payment-settings` and `/manifest.json`
  404s fixed in PR #1294 — new public flows must be added to
  `isPublicRoute` explicitly.

## Notes / accepted risks

1. `/api/access` has no rate limit — single cheap indexed query per call;
   acceptable, revisit if it shows up in usage spikes.
2. `/` and `/watch/[slug]` are `force-dynamic` — the main scalability
   ceiling; see `POST-DEPLOY-AUDIT-2026-07-02.md` for the remediation order.
3. Vercel Hobby: `stripe-reconciliation` cron disabled (documented in
   CLAUDE.md §6); stuck PENDING payments need webhook retry or manual help
   until Pro.
4. Thumbnail storage still on Vercel Blob; migration to R2 tracked in
   `docs/tickets/ready/MEDIA-THUMBNAILS-R2-MIGRATION-001.md`.

## Repo hygiene (addressed by the 2026-07-02 docs consolidation)

- `docs/` had grown to ~280 markdown files (~2 MB), mostly historical
  refactoring reports/tickets from past AI sessions; consolidated into a
  small product documentation set (see `docs/README.md`).
- Root working files (`notatka`, `videosourceschanges.diff`, `_tmp/`)
  removed or archived under `docs/archive/`.
