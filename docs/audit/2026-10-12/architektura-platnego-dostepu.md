# Paid lifetime worldwide access on top of pawelperfect.com: repo-grounded architecture design note (as of 2026-10-12)

Scope: READ ONLY analysis of worktree `polutek-pl/.claude/worktrees/dns-migration-cloudflare-bcfaf0` (branch `review/gate-sound`, HEAD `77fa243b`). Nothing in the repo was changed.
Citation convention: repo facts are cited as `path:line` (lines as of this worktree); external facts have URLs. "Inference" = my design judgement, not a fact from a source.
Tax/legal substance (VAT rates, OSS, registration of a private person, seller identity) is deliberately NOT decided here; only where the architecture must carry the data.

---

## 0. What exists today ("hidden patron scaffolding") and where the repo contradicts the premise

### Takeaway
The repo already has a mature, audited Stripe money ledger (`Payment`, refunds, disputes, reconciliation, webhook locking, admin refund UI) and a single access gate (`checkVideoAccess`), but every one of them is *deliberately wired to a non-commercial model*: tips unlock nothing, there are exactly two tiers, `PatronGrant` is a private ledger, and CLAUDE.md forbids charging for access. Paid lifetime access is therefore a conscious reversal of owner decisions plus one new entitlement concept, not a toggle. The "PATRON" enum value no longer exists in the DB enum (CLAUDE.md §1 is stale on that point).

### Cited Findings (repo)
- **Owner decisions that must be consciously reversed**
  - CLAUDE.md:22-27 (§1): service is non-commercial, "Nigdzie na stronie nie ma bramki płatności", tier set is only `PUBLIC`/`LOGGED_IN`, support is a voluntary non-refundable tip that unlocks nothing and gives no badge.
  - CLAUDE.md:73 (§4.1): `PatronGrant` is a private ledger and "nigdy nie gra roli w dostępie"; do not add `PatronGrant`/`getPatronStatus()` to `checkVideoAccess()` "bez decyzji właściciela o odwróceniu modelu niekomercyjnego".
  - CLAUDE.md:79 (§4.2): every payment success goes through `fulfillPayment()`.
  - CLAUDE.md:91 (§4.4): two tiers; `PATRON_REQUIRED` does not exist.
  - CLAUDE.md:121 (§4.10): `SupportModal` is the *only* payment entry.
  - CLAUDE.md:172+ (§4.14), last bullet: "Nie wprowadzaj opłat za dostęp do treści."
  - `docs/operations/STATUS.md:113-115` ("Decyzje właściciela, które obowiązują"): non-commercial; `Payment`/`PatronGrant` are private records only; two tiers (`PATRON` wygaszone).
  - `docs/architecture/payments-and-tips.md:3,8-9,13`: tip unlocks nothing; no public badge; no `PatronGrant` in `checkVideoAccess()` without an explicit owner decision to reverse the model.
  - Legal text: `app/components/legal/LegalDocs.tsx:41-44` (§1.2 "Serwis ma charakter niekomercyjny… nie prowadzi… sprzedaży… treści cyfrowych"), `:56-58` (§2.1 "Dostęp do treści nigdy nie wymaga płatności"), `:83-107` (§4 "Wsparcie Twórcy": no invoices, non-refundable, `:99` Stripe processes), English mirror `:260-320`; `lib/legal/version.ts:7` (`LEGAL_DOCUMENTS_VERSION = "2026-10-11"`). Seller identity in the documents is "Paweł Perfect, osoba prywatna" (`docs/architecture/i18n-and-legal.md`, "Dokumenty prawne").
- **Contradiction inside the repo (stale doc)**: CLAUDE.md §1 says `PATRON` "istnieje jeszcze w enumie `schema.prisma`", but the enum is `AccessTier { PUBLIC, LOGGED_IN }` (`prisma/schema.prisma:974-977`); migration `20261005210000_cleanup_dead_schema/migration.sql:116-131` recreated the type without `PATRON` and mapped `Video.tier` and `VideoPlaybackSession.accessTier` rows to `LOGGED_IN`. `lib/access-tier.ts:1-7` header says the same. So there is no `PATRON` value to "re-purpose"; PATRON-ish names survive only in `NotificationKind.PATRON` (`schema.prisma:~501`), `BroadcastRecipientGroup.PATRONS/NON_PATRONS` (`:~1123-1125`), `EmailTemplateCategory.PATRON` (`:~1064`), email slug `become-patron` (`lib/modules/email/application/send-transactional-email.use-case.ts:116-123`).
- **`PatronGrant` and who touches it**
  - Model `prisma/schema.prisma:225-242` (`source` enum `STRIPE_TIP|PAYMENT|REFERRAL|ADMIN|MIGRATION|LEGACY`, `paymentId @unique`, `revokedAt/revokeReason/revokedById`).
  - Writers: `lib/modules/payments/application/supporter-grant.ts:19-40` (`ensureSupporterGrant`, called at `fulfill-payment.use-case.ts:87`), `:46-70` (`revokeSupporterGrantIfNoPaidTips`, called from `handle-refund.use-case.ts` on full refund and `handle-dispute.use-case.ts` on open/lost dispute), `:77-100` (`restoreSupporterGrantRevokedFor`), `lib/modules/patron/application/grant-patron.use-case.ts`, `revoke-patron.use-case.ts`, `admin-set-supporter.use-case.ts`, account deletion (`lib/modules/users/application/account-deletion-cleanup.use-case.ts`, `tx.patronGrant.updateMany` revokes active grants).
  - Readers: admin user lists/exports/stats (`lib/modules/users/application/list-admin-users.use-case.ts` etc.). No read in access: `check-video-access.use-case.ts:130-131` comment "never add a PatronGrant check here". `getPatronStatus()` has **zero** non-test callers (grep) and `lib/modules/patron/index.ts` exports it.
- **Single access gate**: `lib/modules/access/application/check-video-access.use-case.ts:104-133`: `toVideoAccessTier(video.tier)`; `PUBLIC` → allow; guest → `LOGIN_REQUIRED` + `requiredTier`; any signed-in non-deleted user → allow. Decision DTO `access-decision.dto.ts` (`requiredTier?: VideoAccessTier`), reasons `access-reason.ts` = `LOGIN_REQUIRED|NOT_FOUND|DELETED|FORBIDDEN`. Callers of `checkVideoAccess` (grep): `PlaybackService`, all comments use cases (`create/delete/list/update/report/get-context/set-reaction...`), `get-public-video-list`, `record-playback-event`, `app/api/access/route.ts`, `VideoContentService.getVideoAccess` (`lib/modules/video/infrastructure/video-content.service.ts:264`).
- **Tier parsing**: `lib/access-tier.ts:8-29`: `VIDEO_ACCESS_TIERS = ["PUBLIC","LOGGED_IN"]`; `toVideoAccessTier(x)` returns `PUBLIC` else `LOGGED_IN` (fail-closed *toward LOGGED_IN*); `parseVideoAccessTier` maps legacy `PATRON`→`LOGGED_IN`; `accessTierWhere`.
- **Playback gating**: `lib/modules/playback/application/playback.service.ts:169` (access), `:196-211` (premiere gate before any source/token), `:224-233` (denied plan), `:249` (`tier = video.tier || 'PUBLIC'`), `:296` (`buildSelfHlsPlan`). `self-hls-plan.ts:109-119` writes `VideoPlaybackSession.accessTier` (`schema.prisma:1269`, enum `AccessTier`). `app/api/media-source/[videoId]/route.ts` returns `Cache-Control: private, no-store` and sanitizes through `toPublicPlaybackPlan` (`public-playback-plan.ts`). Delivery token: HMAC over `videoId/version/exp`, **not user-bound**, default TTL 6 h (`self-hls-token.service.ts:14,47-63`), verified only by signature+expiry in the Worker (`workers/hls-edge/worker.mjs:1-24`, "This is access control, not DRM: a signed-in viewer can copy the URL for the token lifetime").
- **Payments pipeline (tips)**
  - `Payment` (`schema.prisma:167-197`): `userId` NOT NULL, `stripeIntentId @unique`, `stripeSessionId @unique` (column exists but is never written; only read in admin search `list-admin-payments.use-case.ts:45`), `amountMinor`, `refundedAmountMinor`, `status` enum incl. `DISPUTED`/`CHARGEBACK_LOST`, `metadata Json`, `@@unique([userId, requestId])`.
  - Creation: `POST /api/checkout/create-intent` (`app/api/checkout/create-intent/route.ts:20-30` requires session; route is **not** in the public list of `middleware.ts:25-92`) → `createCheckoutIntent` (`create-checkout-intent.use-case.ts:51-117`; `PaymentPolicy.canCreateCheckout` only `user|admin`, `payment.policy.ts:4-6`) → PaymentIntent with `automatic_payment_methods` and idempotency key `payment-intent-<paymentId>` (`:126-147`). **No Checkout Session, no tax, no billing address, no `stripeSessionId` use anywhere.**
  - Fulfillment: `fulfill-payment.use-case.ts:35-116`: CAS `PENDING|FAILED|CANCELED → SUCCEEDED` requiring exact `amountMinor`/`currency`/intent match (`:58-63`, `payment.repository.ts` `fulfillPaymentWithCAS`), `UserPaymentTotal` increment (`:84`), supporter marker (`:87`), post-commit thank-you e-mail/notification (`:107-109`, `:122-152`).
  - Webhook: `app/api/webhooks/stripe/route.ts` → `handleStripeWebhook` (`handle-stripe-webhook.use-case.ts`): signature on raw body, livemode check, `StripeEvent` lock, `dispatchEvent` (`:123-204`) handles `payment_intent.succeeded/payment_failed/canceled`, `charge.refunded`, `charge.refund.updated`, `refund.created/updated/failed`, `charge.dispute.*`; **unknown event types fall to `default: return 'processed'`** (`:~203`), i.e. `checkout.session.*` is currently silently acknowledged.
  - Refund/dispute ledger: `sync-refunds.use-case.ts` (Stripe refund list is truth, row lock), `handle-refund.use-case.ts` (`applyRefundedTotal`), `handle-dispute.use-case.ts`, admin refund `admin-refund.use-case.ts` + panel `apps/admin/app/(panel)/przychody/actions.ts:30-60` (gate: session, rate, step-up, idempotency key, audit).
  - Reconciliation cron `app/api/cron/stripe-reconciliation/route.ts` (every 15 min; PENDING payments older than 15 min, cancels after 24 h, refund pass for 25 paid payments per run).
  - **Money readers that assume Payment = tip** (contamination surface if purchases are written to `Payment`): `lib/modules/video/infrastructure/fundraising-progress.service.ts:12-38` (all SUCCEEDED/PARTIALLY_REFUNDED payments of the channel feed the public fundraising bar), `lib/modules/admin-revenue/queries.ts` (revenue, funnel "Rozpoczęte napiwki"), `lib/modules/admin-analytics/infrastructure/app.repository.ts:39,76`, `lib/modules/admin-overview/*`, `lib/modules/admin-community/application/user-profile.ts:80`, `lib/modules/users/application/get-admin-users-stats.use-case.ts:36`, `export-own-data.use-case.ts:49`, `UserPaymentTotal` (`schema.prisma:1040`).
  - Currency: `PaymentCurrencySetting` (`schema.prisma:1051-1058`) holds only the **tip minimum** per currency; supported currencies `PLN, EUR, USD, CHF, GBP` (`lib/constants.ts:1`), Stripe floors `lib/payments/currency-settings.ts:22-37`. No notion of product price.
  - Tip UI: `app/components/channel/SupportModal.tsx` + `app/components/support/*` (5 steps; Elements/PaymentElement, lazy `getStripeBrowser()`); Terms checkbox → `recordTermsAcceptance` (`lib/modules/users/application/record-terms-acceptance.use-case.ts:9-21`) which stores only the *latest* `User.termsAcceptedAt/termsVersion` (`schema.prisma:36-37`), not a per-transaction record.
- **UI that pins "no payment gating"**: `app/components/PremiumWrapper.tsx:63-76` (`parseVideoAccessTier`), `:419-424` only `LOGIN_REQUIRED`/`COMING_SOON` overlays; `app/components/AccessLockOverlay.tsx:25` (`Extract<PlaybackPlanStatus,"LOGIN_REQUIRED"|"COMING_SOON">`); `lib/modules/playback/domain/playback.dto.ts` `PlaybackPlanStatus` has no purchase state; `lib/modules/channel/application/channel-layout.service.ts:13,40-44,94-96,156-159` (`SidebarViewerState`, sections FREE/LOGGED_IN/UPCOMING, `isLocked`); `app/api/channel/sidebar/route.ts` is `force-dynamic`; admin forms: `apps/admin/components/content/film-form.tsx:127-130` (radio PUBLIC/LOGGED_IN), `lib/modules/admin-community/domain/access-explanation.ts` (hard-coded two tiers, "napiwek niczego nie odblokowuje"); `lib/modules/video/domain/video.policy.ts:84` (Hero must be PUBLIC).
- **Tests that pin the non-commercial/two-tier model** (must be rewritten consciously, not deleted): `tests/unit/access-tier.test.ts:5-8` (`VIDEO_ACCESS_TIERS` toEqual two values; unknown → LOGGED_IN), `tests/unit/patron-grant-truth.test.ts` (user without PatronGrant gets access; guest asked to sign in "never to pay"), `tests/unit/access-source-of-truth.test.ts`, `tests/unit/patron-tier-comments-sign-in.test.ts`, `tests/unit/modules/access/check-video-access.use-case.test.ts`, `tests/unit/components/access-lock-overlay-cta.test.ts` ("never offers a pay-to-unlock CTA", forbids `href="#donations"`, "Odblokuj dostęp", `PATRON_REQUIRED`), `tests/unit/playback-plan-state-messaging.test.ts:31-32` (no `PATRON_REQUIRED`), `tests/unit/public-loading-state-ux.test.ts:123`, `tests/unit/channel-layout-patron-grant.test.ts`, `tests/unit/modules/email/forbidden-mutations.test.ts` (email module may not mutate `payment`/`patronGrant`), `tests/unit/legal-docs-consistency.test.ts` (providers, retention, PL/EN structure), `tests/unit/admin-app/tresci-actions.test.ts`, `tests/unit/modules/video/video.policy.test.ts`. Note test debt: several still reference `AccessTier.PATRON` (e.g. `access-source-of-truth.test.ts`), which no longer exists in the Prisma enum.
- **Docs/stale comment**: `schema.prisma:481-482` (`Subscription` comment says "active PatronGrant rows are the only access source of truth", contradicting §4.1).

### Inferences
- The scaffolding is *reusable money plumbing*, not an access system. What is truly "hidden" is (a) the refund/dispute/reconcile machinery keyed by `Payment`, (b) `PatronGrant`'s grant/revoke/restore-by-reason pattern (a good template for entitlements), (c) `checkVideoAccess` being the single funnel for playback, comments and listing.
- Because access reads go through a single funnel, the safest design keeps that funnel and adds one new, separately named concept (entitlement) instead of re-using `PatronGrant`.

### Gaps
- Whether `AccessTier.PATRON` was already removed on the *production* DB (STATUS.md:46 says deployment 2 on 2026-10-05 ran `20261005210000`; I did not verify prod).
- No evidence in repo of current live Stripe configuration (webhook endpoint events, Tax registrations); `STATUS.md:80-82` says no real payment has ever been received and webhook never got a live event.

---

## 1. Minimal change to reintroduce a third access tier safely

### Takeaway
Add a new enum value **`PAID`** (not "PATRON": that word is reserved for tip semantics and test pins) to `AccessTier`, teach `lib/access-tier.ts` about it *before* any video can be set to it, extend `checkVideoAccess` with one entitlement lookup behind an exhaustive `switch`, and add a distinct denial reason/plan state `PURCHASE_REQUIRED`. The single most dangerous trap is that today's helper is fail-closed *toward LOGGED_IN*: an un-updated reader would silently make PAID videos free for every signed-in user.

### Cited Findings
- `toVideoAccessTier` returns `LOGGED_IN` for everything that is not `PUBLIC` (`lib/access-tier.ts:12-14`), `parseVideoAccessTier` accepts only `PUBLIC|LOGGED_IN|PATRON(→LOGGED_IN)` (`:17-21`), `accessTierWhere` maps `LOGGED_IN` to `{ not: "PUBLIC" }` (`:24-29`).
- Readers of tier (grep `toVideoAccessTier|parseVideoAccessTier|accessTierWhere|requiredTier|LOGGED_IN`): `lib/modules/access/application/check-video-access.use-case.ts`, `access-decision.dto.ts`, `lib/modules/playback/application/playback.service.ts` + `domain/playback.dto.ts`, `lib/modules/video/domain/video.dto.ts:174`, `video.policy.ts:84,123-124`, `video-content.service.ts`, `video.repository.ts`, `admin-video-payload.ts`, `lib/modules/channel/application/channel-layout.service.ts`, `lib/modules/comments/domain/comment-frontend.dto.ts`, `lib/modules/admin-content/application/content.ts`, `lib/modules/admin-community/domain/access-explanation.ts`, `app/types/video.ts:30,75-76`, `app/components/{PremiumWrapper,Hero,ChannelVideoCard}.tsx`, `app/components/channel/{SidebarPlaylist.tsx,sidebar-layout-request.ts}`, `lib/data/initial-content.ts`, and `apps/admin/{app/(panel)/tresci/*,components/content/film-form.tsx,new-film-form.tsx,lib/content.ts,lib/content-fixtures.ts}`.
- Comments are publicly readable only when the denial reason is exactly `LOGIN_REQUIRED` (`lib/modules/comments/application/list-video-comments.use-case.ts`, `isPubliclyReadableReason`); any other denial returns FORBIDDEN. So a new reason changes comment visibility on paid videos unless handled.
- Migration precedent for enum surgery: `20261004230000_video_tier_patron_to_logged_in` (data move first, enum later) and `20261005210000...:116-131` (type recreate). CLAUDE.md:67-72 (§4.0): migrations additive, never edit existing, deploy in two steps, `deploy.sh --rollback` restores code only.
- `VideoPlaybackSession.accessTier` also uses `AccessTier` (`schema.prisma:1269`), so the enum change touches telemetry-ish rows too.

### Inferences — proposed design
1. **Enum**: migration `add_access_tier_paid`: `ALTER TYPE "AccessTier" ADD VALUE 'PAID'` alone in its own migration file (Postgres cannot use a new enum value inside the transaction that adds it; keep data changes out of it). No video is set to PAID by this migration.
2. **`lib/access-tier.ts`**: `VIDEO_ACCESS_TIERS = ["PUBLIC","LOGGED_IN","PAID"]`; `toVideoAccessTier("PAID") === "PAID"`; unknown still → `LOGGED_IN` *only for legacy strings* (`PATRON`), but add `assertNever`-style exhaustive helpers (`isPaidTier()`, `requiresSignIn()`), and `accessTierWhere("LOGGED_IN")` must become `"LOGGED_IN"` exactly (today `{ not: "PUBLIC" }` would also list PAID rows under "LOGGED_IN" in the admin filter). Rewrite `tests/unit/access-tier.test.ts`.
3. **Deploy order (critical)**: (a) ship code that understands `PAID` and has the entitlement branch, flag off, admin forms still offering only two radios; (b) only then expose the third radio in `film-form.tsx`/`new-film-form.tsx` and `admin-video-payload.ts`. Rationale: rolling deploys or `--rollback` to an older image would map PAID → LOGGED_IN = free. Add a rollback note to CLAUDE.md §4.0 ("after a video is PAID, rolling back to a pre-PAID image opens that video to every signed-in user: set those videos back to a draft first").
4. **`checkVideoAccess`** (`check-video-access.use-case.ts:104-133`): after the existing deleted/missing user checks (`:122-128`), replace the unconditional `allow` with:
   - `switch (tier)`: `PUBLIC` → allow; `LOGGED_IN` → allow; `PAID` → `hasActiveEntitlement(userId, scopeOf(video))` ? allow : `{hasAccess:false, reason:"PURCHASE_REQUIRED", requiredTier:"PAID"}`; `default: never` → deny `FORBIDDEN`.
   - Guest on PAID video: keep `LOGIN_REQUIRED` with `requiredTier:"PAID"` (so comments stay publicly readable and the login wall comes first; the UI after login shows the purchase CTA). Admin bypass (`:102`) stays.
   - Entitlement lookup is one indexed query: `entitlement.findFirst({ userId, revokedAt: null, OR:[{scope:ALL},{scope:VIDEO, videoId}] , validFrom<=now })`. No cache (access is already DB-read per request; user row is read at `:122`).
   - **Never** read `PatronGrant` here (keeps §4.1 intact; only its literal wording "never add a PatronGrant check" needs a clarifying sentence that entitlements are a different table).
5. **Reasons and plan states**: add `PURCHASE_REQUIRED` to `access-reason.ts`, to `PlaybackPlanStatus` and `playback-plan-state.ts`/`AccessLockOverlay` (`AccessLockState` extract at `:25`), and to `toStatus()` in `playback.service.ts:82-86`. Decide explicitly whether `list-video-comments` treats it as publicly readable (one-line change, owner decision: spoilers vs. social proof). `create-video-comment` etc. get denial automatically (comments need access to write), which matches "pay to participate" but is a product decision.
6. **DTOs/UI**: `PublicVideoDTO.tier` becomes `PUBLIC|LOGGED_IN|PAID` (`video.dto.ts:174`, `app/types/video.ts:76`); add per-viewer `isEntitled`/`hasAllAccess` to the *sidebar response and plan* only (never public lists; `/api/channel/sidebar` is `force-dynamic`, `app/api/channel/sidebar/route.ts`). `ChannelLayoutService`: `SidebarSection.type` gets `"PAID"`, `isLocked()` (`:156-159`) needs viewer entitlement; PAID videos are never Hero (`video.policy.ts:84` already blocks non-PUBLIC).
7. **PATRON residue**: leave `NotificationKind.PATRON`, `BroadcastRecipientGroup.PATRONS/NON_PATRONS`, `EmailTemplateCategory.PATRON` alone in phase 1 (they are tip-supporter concepts, and §4.6 says there is no supporter segment); do **not** reuse them for buyers. Consider the pending cleanup migration (STATUS.md:84-85) separately.
8. **Playback**: no change to `buildSelfHlsPlan` signature except passing `tier:"PAID"` (written to `VideoPlaybackSession.accessTier`) and, for PAID, a short `ttlSeconds` (see §6). Premiere gate order stays: premiere before tier (`playback.service.ts:196-211`).
9. **Tests to add**: exhaustive matrix `tier ∈ {PUBLIC,LOGGED_IN,PAID} × actor ∈ {guest,user,user+entitlement,user+revoked,deleted,admin} × premiere {past,future}` in `tests/unit/modules/access/`; a source-reading test that every file in the reader list above handles `PAID` (grep-style, like existing convention in `tests/unit/components/access-lock-overlay-cta.test.ts`); Postgres test for the enum migration (`tests/postgres/`, pattern of `db-cleanup-migration.pg.test.ts`).

### Gaps
- Per-video vs all-access: the design supports both through `Entitlement.scope`, but the *tier* is per video. "All content paid" can be a site setting (every non-Hero video PAID) or per-video; owner decision.
- I did not enumerate every `.tsx` consumer of `requiredTier` line by line; the list above is from grep and the implementing agent should re-grep.

---

## 2. Entitlement model

### Takeaway
New tables `Order` (commercial record: price, tax snapshot, waiver, provider ids) and `Entitlement` (access right: user, scope, source, grant/revoke timestamps). Do **not** reuse `PatronGrant` (private tip ledger, §4.1, one-per-user semantics, deleted/revoked on account deletion, readers assume "supporter"). For money movement, **reuse `Payment`** with a new `kind` discriminator so refunds/disputes/reconciliation work unchanged, but write the `Payment` row only at fulfilment because the gross amount is unknown until Stripe has computed tax. Phase 1 is account-bound (login before buy); guest checkout and gifting are later, optional.

### Cited Findings
- `PatronGrant` is `@@index([userId, revokedAt])`, one active marker per user by convention (`supporter-grant.ts:19-40` "One active grant per user is enough"), `paymentId @unique`, no scope/video/product/validity fields (`schema.prisma:225-242`), and is revoked wholesale on account deletion.
- `Payment.userId` is NOT NULL and the unique key is `(userId, requestId)` (`schema.prisma:167-197`); create-intent route requires a session (`app/api/checkout/create-intent/route.ts:20-30`) and `/api/checkout/*` is not in the public route list (`middleware.ts:25-92`).
- `fulfillPaymentWithCAS` requires `amountMinor` and `currency` equality with the pre-created row (`payment.repository.ts`, `fulfill-payment.use-case.ts:58-63`).
- Stripe's Checkout computes tax from the customer's address *inside* Checkout; the result is read from `total_details.amount_tax` of the session — [Stripe: Collect tax with the Checkout page](https://docs.stripe.com/tax/checkout/page). Stripe Tax only collects tax in jurisdictions where an active registration exists (same page).
- Managed Payments (Stripe as merchant of record) deletes personal data from Stripe objects (Customer, PaymentIntent, Charge, Invoice…) when the customer requests deletion — [Stripe: How Managed Payments works, "Handle data deletion requests"](https://docs.stripe.com/payments/managed-payments/how-it-works).
- Account deletion keeps `Payment`/`AuditLog` rows and anonymises the `User` into a tombstone (`account-deletion-cleanup.use-case.ts`; `docs/architecture/privacy-email-retention.md:17`); `User.isDeleted` already short-circuits `checkVideoAccess` with `DELETED` (`check-video-access.use-case.ts:128`).
- There is no account-merge feature in the repo; account linking only attaches login methods to the same `User` (Better Auth; takeover guard `beforeAccountCreate` per CLAUDE.md §4.12). E-mail change flow exists (`sendChangeEmail*` in `send-transactional-email.use-case.ts:134-146`).

### Inferences — proposed data model (additive migration after `20261006091000_stripe_customer_anonymization`)

```prisma
enum PaymentKind { TIP PURCHASE }                       // Payment.kind @default(TIP): old code and old rows stay tips
enum OrderStatus { PENDING PAID EXPIRED REFUNDED PARTIALLY_REFUNDED DISPUTED CHARGEBACK_LOST }
enum EntitlementScope { ALL_CONTENT VIDEO }              // SERIES later via a Playlist/Series model that does not exist yet
enum EntitlementSource { STRIPE_CHECKOUT MOR ADMIN PROMO MIGRATION }

model Order {
  id                    String      @id @default(uuid())
  userId                String                       // NOT NULL in phase 1 (login-first)
  buyerEmail            String                       // snapshot at purchase (anonymised on account deletion, see §5)
  productCode           String                       // "ALL_ACCESS_LIFETIME" | "VIDEO:<id>"
  provider              String                       // "STRIPE_CHECKOUT" | "STRIPE_MANAGED" | "PADDLE"
  providerSessionId     String      @unique          // cs_...
  providerPaymentRef    String?     @unique          // pi_... (matches Payment.stripeIntentId)
  paymentId             String?     @unique          // FK -> Payment(kind=PURCHASE), set at fulfilment
  status                OrderStatus @default(PENDING)
  currency              String
  amountGrossMinor      Int?                         // set at fulfilment (session.amount_total)
  amountTaxMinor        Int?                         // session.total_details.amount_tax
  taxBehavior           String?                      // inclusive|exclusive snapshot
  taxCountry            String?                      // jurisdiction used (billing/IP evidence country)
  taxJurisdiction       Json?                        // breakdown snapshot: [{country,state,rate,type,taxableMinor,taxMinor,reason}]
  buyerCountry          String?                      // customer_details.address.country
  buyerIsBusiness       Boolean     @default(false)
  buyerTaxId            String?                      // VAT-ID if collected (+ validation status in taxJurisdiction)
  priceListVersion      String?                      // which price table/coupon produced the amount
  couponCode            String?
  // Withdrawal-right waiver evidence (EU CRD Art. 16(m)); see §4
  waiverAcceptedAt      DateTime?
  waiverTextVersion     String?                      // id of exact wording shown (i18n key + language)
  waiverLanguage        String?
  termsVersion          String?                      // LEGAL_DOCUMENTS_VERSION at purchase
  receiptUrl            String?
  invoiceRef            String?
  createdAt             DateTime    @default(now())
  paidAt                DateTime?
  refundedAt            DateTime?
  @@index([userId, status]) @@index([status, createdAt]) @@index([taxCountry, paidAt])
}

model Entitlement {
  id            String            @id @default(uuid())
  userId        String
  scope         EntitlementScope
  videoId       String?                              // required when scope = VIDEO
  source        EntitlementSource
  orderId       String?                              // null for ADMIN/PROMO grants
  grantedById   String?                              // AdminUser.id (no FK, like AuditLog.actorUserId)
  grantedAt     DateTime          @default(now())
  validUntil    DateTime?                            // null = lifetime
  revokedAt     DateTime?
  revokeReason  String?                              // exact reason string enables restore-after-dispute (pattern of restoreSupporterGrantRevokedFor)
  @@index([userId, revokedAt]) @@index([orderId])
  // partial unique (raw SQL in migration): one ACTIVE entitlement per (userId, scope, coalesce(videoId,''))
}
```

- **Reuse of `Payment`** (`kind=PURCHASE`): created in the same transaction that marks the `Order` PAID, with `stripeIntentId = session.payment_intent`, `amountMinor = amount_total`, `status=SUCCEEDED`. After that the existing refund/dispute/reconcile code finds it by `stripeIntentId` (`payment.repository.ts findByIntentId`, `sync-refunds.use-case.ts`). Needed `kind` switches (each is a few lines): `fulfillPayment` must never be called for PURCHASE (no supporter grant, no `UserPaymentTotal`, no tip e-mails); in `applyRefundedTotal`/`handleDispute` replace the `revokeSupporterGrant*` calls by `revokeEntitlementForOrder`/`restoreEntitlementRevokedFor` when `payment.kind === PURCHASE`; filter `kind: TIP` in the money readers listed in §0 (fundraising, revenue, funnel, user stats). Safety net: a source-reading test asserting every `prisma.payment.*` query under `lib/` mentions `kind` or is allowlisted.
- **Why not `Order` as the only ledger (no `Payment` row)**: it would duplicate `sync-refunds`/`handle-refund`/`handle-dispute`/`admin-refund`/`reconcile` (~6 files of audited money logic: PA-04 etc.). Cost of the chosen approach: ~10 reader filters. Alternative (cleaner, costlier) is documented here so the owner/agent can choose.
- **Revocation semantics** (mirror tip logic, `handle-dispute.use-case.ts`, `supporter-grant.ts:46-100`): full refund → revoke (`revokeReason="Order refunded: <orderId>"`); open dispute → suspend with `disputeSuspensionReason(disputeId)`, restore if closed in buyer's disfavour (matches exact reason string); chargeback lost → revoke permanently; partial refund → keep (policy decision). ADMIN grants are never auto-revoked.
- **Guest checkout / buy-before-login**: phase 1 = no (consistent with the tip flow, which opens the login dialog first, `SupportModal.tsx` `handleAmountNext`). If wanted later: allow an unauthenticated `POST /api/purchase/session` (add to `isPublicRoute`, Turnstile + rate limit), store `Order.userId = null`/`buyerEmail`, deliver a claim link; claim only binds when the signed-in account has `emailVerified` and the same e-mail (avoids binding to unverified accounts; Better Auth's account-takeover guard is the relevant precedent, CLAUDE.md §4.12). This needs `Order.userId` nullable and `Payment.userId` workaround (create `Payment` only when claimed, or a placeholder system user) — hence "phase 4, optional".
- **Account merging**: no feature exists; entitlements key on `User.id`, so linking Google/password to the same user keeps them. A manual admin "move entitlement" (revoke+grant with `source=ADMIN`, reason, audit) covers rare cases; no automatic merge.
- **Gifting**: `GiftCode` table (hashed code, `orderId`, `redeemedByUserId`, `redeemedAt`); the buyer's order carries the waiver; the recipient receives an `Entitlement(source=PROMO or GIFT)` on redemption. Withdrawal-right/refund semantics for gifts and VAT place-of-supply are unresolved → defer.
- **Scope extension**: `scope=VIDEO` with `videoId` supports per-video purchases without schema change; `SERIES` would need a collection model that does not exist (no playlists in schema; sidebar sections are computed).

### Gaps
- Whether a private person selling worldwide needs the buyer as `userId`-only or a legally required invoice recipient record (owner/accountant).
- `taxJurisdiction` JSON shape depends on what Stripe returns for the chosen path; not verified against live objects (needs a test-mode session).

---

## 3. Integration paths

### Takeaway
Three realistic paths: **A** Stripe Checkout Session + Stripe Tax (you stay merchant of record: you register for VAT/OSS and file), **B** classic third-party MoR (Paddle-style), **C** *Stripe Managed Payments* (Stripe/Link as MoR, available in Poland per Stripe docs as of this research; ~3.5% on top of Stripe fees per a third-party blog). All three need a **new hosted-checkout purchase flow**; the existing Elements/PaymentIntent tip modal cannot be extended (Managed Payments explicitly does not support Elements-based flows, and Stripe Tax's automatic address-based tax needs Checkout or the Tax Calculation API). Keep tips as a separate, unchanged flow.

### Cited Findings
- **Path A mechanics**: `automatic_tax[enabled]=true` + `customer_creation=always` or existing `customer`; address hierarchy shipping → billing; `billing_address_collection=required` and `customer_update[address]=auto`; tax result in `total_details.amount_tax`; tax codes per product — [Stripe Tax with Checkout](https://docs.stripe.com/tax/checkout/page). Tax registrations must be created per jurisdiction first (same page). Tax-ID (VAT) collection has its own page: [Collect tax IDs with Checkout](https://docs.stripe.com/tax/checkout/tax-ids) (linked from [Collect tax with Checkout](https://docs.stripe.com/tax/checkout); page content not fetched).
- **Path A events**: Stripe's guidance for Checkout is `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and to avoid relying only on the success page — [Stripe: Managed Payments set-up, "Handle post-payment events"](https://docs.stripe.com/payments/managed-payments/set-up) (same events for plain Checkout; fulfilment guide: [Fulfill orders](https://docs.stripe.com/checkout/fulfillment), body not retrievable via fetch).
- **Path C (Managed Payments)**: Stripe is merchant of record, handles tax, fraud, disputes, receipts/invoices from Link, "Sold through Link", statement descriptor `LINK.COM* …` — [Overview](https://docs.stripe.com/payments/managed-payments), [How it works](https://docs.stripe.com/payments/managed-payments/how-it-works). Seller business location list includes **PL**; supported products include digital audio-visual works and online courses, each product needs an eligible tax code (e.g. `txcd_10402000` streamed AV non-subscription limited rights; `txcd_10402100` downloaded, permanent rights; `txcd_10804003` bundle permanent+streamed); eligibility is subject to a Stripe review of "business type and geography"; Connect and Elements/"advanced integrations" are unsupported; customers from 195 countries except CN, CU, IR, KP, RU, SY and a few territories — [Eligibility](https://docs.stripe.com/payments/managed-payments/eligibility). Enabled per Checkout Session with `managed_payments[enabled]=true`, API version `2025-03-31.basil` or later (repo pins `2026-02-25.clover`, `lib/modules/payments/infrastructure/stripe-client.ts`), price `tax_behavior` defaults to exclusive unless set — [Set up Managed Payments](https://docs.stripe.com/payments/managed-payments/set-up). Tax handled in 80+ countries (list includes all EU, GB, CH, US, CA, AU, JP…); elsewhere the seller remains liable (Stripe Tax can be used at no extra calculation fee) — [Tax compliance](https://docs.stripe.com/payments/managed-payments/tax-compliance). Custom domains are not supported on Managed Payments checkouts; Stripe may refund within 60 days "in certain cases"; refund returns tax and Stripe may keep remitted sales tax (How it works). Reports expose `withheld_tax` columns (How it works, "Reports").
- **Path C price**: "3.5% per successful Managed Payments transaction in addition to Payments fees" per a competitor's blog dated 2026-05-01 — [Dodo Payments](https://dodopayments.com/blogs/stripe-managed-payments-fees-explained) (secondary, competitor source; confirm on Stripe's own pricing page, which returned 404 for the URL I tried).
- **Path B example (Paddle)**: one-time price = product without recurring interval, fulfilled via the `transaction.completed` webhook, same checkout/webhooks/SDKs as subscriptions — [Paddle: digital products](https://developer.paddle.com/get-started/how-paddle-works/digital-products); pay-as-you-go 5% + 50¢ per checkout transaction, tax/compliance, fraud, chargebacks and buyer support included, products under $10 require contacting Paddle — [Paddle pricing](https://www.paddle.com/pricing). Lemon Squeezy (another MoR): **not researched**.
- Existing infra that all paths reuse: `StripeEventLockService` + `handleStripeWebhook` skeleton, webhook signature/livemode guard (`handle-stripe-webhook.use-case.ts`), `getStripeClient` (single client), `recordAuditEvent` (`lib/modules/audit`), cron runner (`scripts/serwerek/cron-runner.sh`), email transport.
- Note: STATUS.md:46 says the live webhook must also subscribe to `refund.created/updated/failed`; no purchase-related events are subscribed today (default branch ignores them).

### Inferences — sequence diagrams (text)

**Path A / C (Stripe-hosted Checkout; C = same plus `managed_payments[enabled]=true` and an eligible tax code)**
```
Viewer (signed in)            www (Next.js)                         Stripe                    Postgres
 | click "Buy lifetime" in PurchaseDialog (waiver checkbox ticked + buyer consent sent)
 |--POST /api/purchase/checkout {product, currency, waiverVersion, lang, requestId}-->
 |                          auth() session; rate-limit; reject if active ALL_CONTENT entitlement (409)
 |                          INSERT Order(PENDING, waiver*, termsVersion)  --------------------------> [Order]
 |                          sessions.create(mode=payment, line_items[price], automatic_tax.enabled,
 |                            billing_address_collection=required, tax_id_collection.enabled (B2B, path A),
 |                            customer=<User.stripeCustomerId>, customer_update[address]=auto,
 |                            client_reference_id=Order.id, metadata{orderId,userId,productCode,waiverVersion},
 |                            consent_collection[terms_of_service]=required (+custom_text), locale,
 |                            success_url=/channel?purchase=success&order=<id>, cancel_url, expires_at=+30min,
 |                            idempotencyKey="checkout-session-"+Order.id) ------------------------>
 |<--{url}-------------------  UPDATE Order.providerSessionId
 |--redirect to checkout.stripe.com (tax shown incl. VAT; pays: card/Apple Pay/BLIK/P24...)---------->
 |                                                         | payment succeeds
 |                                  webhook checkout.session.completed (payment_status=paid) <-------|
 |                          verify signature (raw body) -> StripeEvent lock (dedupe by event.id)
 |                          fulfillPurchase(session):  [one DB transaction, CAS Order PENDING->PAID]
 |                            assert metadata.orderId == client_reference_id, userId match, currency/product match,
 |                              amount_total >= price floor, livemode == key mode
 |                            INSERT Payment(kind=PURCHASE, stripeIntentId=session.payment_intent, SUCCEEDED, amount_total)
 |                            UPDATE Order(PAID, gross, tax, taxCountry, taxJurisdiction, buyerCountry, taxId, receipt)
 |                            INSERT Entitlement(ALL_CONTENT, STRIPE_CHECKOUT, orderId)  (unique per active scope)
 |                            audit ORDER_PAID, ENTITLEMENT_GRANTED
 |                          after commit: sendEmail("access-granted"), in-app notification
 |<--return page polls GET /api/purchase/[orderId] (fast path: if still PENDING, sessions.retrieve and fulfil)
 |--full window.location reload (drop cached plans/sidebar) ----> videos play: checkVideoAccess sees entitlement
 | later: refund/dispute events -> existing sync-refunds/handle-dispute by Payment.stripeIntentId
 |        -> (kind=PURCHASE) revoke / suspend / restore Entitlement; Order.status mirrors Payment
 | cron stripe-reconciliation (15 min): Orders PENDING > 15 min -> sessions.retrieve: paid->fulfil, expired->EXPIRED
```
Delayed methods (BLIK/P24 are immediate-ish; bank debits/vouchers delayed): grant only when `payment_status=paid` on `completed` or on `async_payment_succeeded`; on `async_payment_failed` mark Order `EXPIRED/FAILED`, no entitlement.

**Path B (classic MoR, Paddle-style overlay/hosted checkout)**
```
Viewer -> POST /api/purchase/checkout -> Order(PENDING) ; response {transactionId | checkout url, customData:{orderId,userId}}
Viewer -> provider overlay/hosted checkout (provider is seller; owns tax, invoice, refunds UI, disputes)
Provider -> POST /api/webhooks/<provider> (transaction.completed)  [signature scheme differs: new verifier + new event lock table or reuse StripeEvent with prefix]
         -> fulfillPurchase(provider payload): Order PAID (+ provider tax figures, payout currency), Entitlement(source=MOR)
Provider -> adjustment.created/refund & chargeback webhooks -> revoke/suspend entitlement
No Payment row: our Stripe account never sees the money; admin refund = deep link to provider dashboard (or provider API).
```
What changes versus Stripe path: no Stripe refund/dispute reuse (money is not in our Stripe), a second webhook endpoint/verifier/secret + CSP additions for the provider's overlay script (`lib/utils/security.ts` `generateCSP`, CLAUDE.md §4.21 requires adding hosts there), new admin revenue import, and the privacy policy lists a new processor (the consistency test `legal-docs-consistency.test.ts` pins the provider list).

### What changes in `SupportModal` (tips) vs the new flow
- Tips (donations) stay exactly as is: `SupportModal.tsx`, `TipDisclaimerStep.tsx` ("a tip unlocks nothing" remains true), `create-intent`, `fulfillPayment`, `PatronGrant`. They are legally and fiscally a different thing than a sale; merging the flows would break §4.10 and the tip disclaimer/terms. Decision whether to *retire* tips belongs to the owner (if all content is paywalled, a tip button is still coherent; if the owner wants one money flow, removing it means deleting `lib/modules/patron`, `ensureSupporterGrant`, `PatronGrant` writes: a later cleanup, not part of this).
- New: `app/components/purchase/PurchaseDialog.tsx` (hosted-redirect, no Stripe.js needed; so CSP `connect-src/frame-src` for `js.stripe.com` is not required for this path; `checkout.stripe.com` is only a redirect target), CTA inside `AccessLockOverlay` for `PURCHASE_REQUIRED`, a "Buy" button in the nav/Hero. The existing event name `polutek:open-support` (`AccessLockOverlay`, `ChannelHome`) must not be reused for the purchase (tests pin no pay CTA there today).
- Return handling mirrors tips (`payments-and-tips.md:38-42`): trust Stripe's signal for the screen, poll to upgrade, close with a full `window.location` so server-rendered surfaces refresh.

### Gaps
- Whether a *private individual* passes Stripe's Managed Payments "eligibility review" (docs say business type is considered; no explicit rule for sole proprietors found).
- Whether `ui_mode=embedded_page` (embedded Checkout) is allowed with Managed Payments: docs list "embeddable web components" as unsupported but the tax page shows `ui_mode=embedded_page` for plain Checkout; not confirmed for MP.
- Who captures/owns the EU withdrawal waiver under Managed Payments: docs only say Stripe "applies applicable consumer protection requirements, such as regional cooling off periods" ([Eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)); whether a seller-side checkbox is still needed/possible is unverified.
- Paddle's/Lemon Squeezy's 2026 seller-eligibility rules for private individuals and content categories not researched; Lemon Squeezy status after Stripe acquisition not researched.
- `total_details.breakdown` structure for jurisdiction snapshot not verified from docs (only `amount_tax` is cited).

---

## 4. Withdrawal-right waiver, price display, multi-currency, regional pricing, coupons, B2B VAT

### Takeaway
Store the waiver as evidence on `Order` (timestamp, exact wording id + language, terms version, plus the Stripe-side consent record), show gross (tax-inclusive) prices via Stripe `tax_behavior: inclusive`, model prices as a product price table (per-currency fixed prices) separate from `PaymentCurrencySetting` (tip minimums), and keep coupons/free grants as Entitlement sources. The legal wording and whether the waiver is valid for "access lifetime" content is a lawyer decision.

### Cited Findings
- EU rule: the withdrawal right for digital content not on a tangible medium can be excluded only if performance began with the consumer's prior express consent and acknowledgement that the right is lost (Art. 16(m) CRD) — [Directive 2011/83/EU Art. 16 (legislation.gov.uk snapshot)](https://www.legislation.gov.uk/eudr/2011/83/article/16); the consolidated EU text also requires the trader's confirmation on a durable medium (Art. 7(2)/8(7)) — described in secondary sources; I could not retrieve the EUR-Lex wording (fetch returned empty). Secondary: the UK snapshot omits the confirmation condition, so check the current EUR-Lex text (per web search summary). CJEU C-641/19 *EU v PE Digital* is cited as interpreting the digital-content/service distinction strictly (via [William Fry](https://www.williamfry.com/knowledge/world-consumer-rights-day-part-2-reshaping-online-subscription-rights-the-sky-austria-case/)).
- Stripe Checkout can force a consent checkbox with `consent_collection[terms_of_service]=required`, custom label via `custom_text[terms_of_service_acceptance][message]` (Markdown link) and extra text near the pay button via `custom_text` (up to 1200 chars); Stripe warns not to contradict its own text — [Stripe: customize text and policies](https://docs.stripe.com/payments/checkout/customization/policies) (page body retrieved only through search snippets). Stripe does not claim its checkbox satisfies Art. 16(m) (search summary).
- Price tax-behavior: Managed Payments adds tax on top unless `tax_behavior: inclusive` is set on the price or in Tax settings — [Set up Managed Payments](https://docs.stripe.com/payments/managed-payments/set-up).
- Adaptive Pricing is on by default in Managed Payments and converts to local currency — [How it works](https://docs.stripe.com/payments/managed-payments/how-it-works); Adaptive Pricing and Stripe Tax interplay documented at [docs.stripe.com/tax/calculating/adaptive-pricing](https://docs.stripe.com/tax/calculating/adaptive-pricing) (linked, not fetched).
- Repo: currencies `PLN/EUR/USD/CHF/GBP` fixed in `lib/constants.ts:1`; `detectDefaultCurrency` (`lib/payments/detect-currency.ts`) maps language/locale/timezone to currency; country is available server-side from `CF-IPCountry` (`lib/i18n/server-language.ts:12-22,77`); `PaymentCurrencySetting.minAmountMinor` is a tip floor (`currency-settings.ts:22-37`).
- Terms acceptance today: `User.termsAcceptedAt/termsVersion` only (`schema.prisma:36-37`).

### Inferences — design
1. **Waiver capture (two controls, not one)**: in `PurchaseDialog` (before redirect) show two separate unchecked checkboxes, i18n through `tx()` and the six catalogs (`lib/i18n/catalog/*.json`, parity test): (a) "I want access to start immediately", (b) "I acknowledge I lose my 14-day right of withdrawal once access starts". Also repeated with `custom_text[submit]` on the Stripe page. Server rejects session creation unless both flags arrive; persist `Order.waiverAcceptedAt`, `waiverTextVersion` (key like `purchase.waiver.v1`), `waiverLanguage`, `termsVersion=LEGAL_DOCUMENTS_VERSION`, plus `metadata.waiverVersion` on the session so Stripe holds a mirror. Send a post-purchase confirmation e-mail with the waiver text and Terms (durable medium; our own mail, `access-granted` template). Keep wording versioned: changing text = new `waiverTextVersion`, never edit.
2. **Do not start supply before consent**: entitlement is created only after payment *and* `waiverAcceptedAt` present (code path assertion; entitlement without waiver → alert + admin queue).
3. **Price display incl. tax**: Stripe prices created with `tax_behavior: inclusive`; `PurchaseDialog` shows an indicative gross price per currency from our own `ProductPrice` table, with note "final price incl. VAT is shown at checkout"; under Path C Adaptive Pricing may present a converted local price (cannot be fully predicted by us).
4. **Multi-currency**: introduce `ProductPrice { productCode, currency, unitAmountMinor, stripePriceId, active }` (or Stripe Price `currency_options`) and a `GET /api/purchase/prices` public route (cache-safe: no viewer data). Reuse the `SUPPORTED_CURRENCIES` list and `detectDefaultCurrency`; do **not** repurpose `PaymentCurrencySetting` (its semantics and admin screen are "tip minimum"). Stripe floors in `STRIPE_MIN_CHARGE_MINOR` are irrelevant for a fixed price but keep a validation test.
5. **Regional/geo pricing**: possible with one Price per region chosen server-side from `CF-IPCountry`/billing country, but (a) VPN abuse, (b) must be shown consistently incl. tax, (c) legal check for EU geo-blocking/price-discrimination rules (not researched). Recommendation: launch with one price per currency (no PPP), revisit after data. Path C's Adaptive Pricing already localises currency.
6. **Coupons/free grants**: (a) admin grant → `Entitlement(source=ADMIN)` via panel (reason mandatory, audit `ENTITLEMENT_GRANTED`); (b) promo codes → either Stripe Promotion Codes (`allow_promotion_codes=true`, discount appears in session totals; record `Order.couponCode`) or an own `PromoCode` table redeemed server-side to `Entitlement(source=PROMO)` without payment. 100%-off sessions: Stripe may complete with `payment_status=no_payment_required`; `fulfillPurchase` must accept that and create no `Payment` row.
7. **B2B VAT-ID collection**: Path A: `tax_id_collection[enabled]=true` (+ `customer_update[name]=auto`); store `Order.buyerIsBusiness`, `buyerTaxId`, validation status; invoice issuance and reverse-charge handling are then Stripe Tax's job but need a registered seller. Path C: Stripe is the seller of record; B2B tax-ID handling is Stripe's (not verified in docs fetched). A *private individual* seller issuing B2B invoices is another legal point for the accountant.

### Gaps
- Exact EUR-Lex wording of Art. 16(m)/7(2)/8(7) (fetch returned empty; only a historical UK mirror and secondary summaries were obtained).
- Whether a one-time "lifetime" access for streaming is classed as digital content (waiver per Art. 16(m)) or service (waiver only on full performance, Art. 16(a)) — legal classification not resolved; the Stripe/MoR tax code choice (`streamed … limited rights` vs `permanent rights`) is related and unclear for "lifetime streaming".
- Geo-pricing legality (EU Geo-blocking Regulation, consumer law) not researched.

---

## 5. Operations: tax reporting, admin panel, audit, e-mails, cron, telemetry, GDPR retention

### Takeaway
Everything operational has a ready pattern in the repo: panel actions through `openGate` + `recordAuditEvent`, CSV export via `toCsv`, e-mail templates in `lib/email-defaults.ts`, cron via systemd timers calling `/api/cron/*`, aggregate-only telemetry, tombstone-on-delete. The new parts are a per-country tax export built from our own `Order` snapshot and a retention rule for `Order` that outlives account deletion.

### Cited Findings
- Panel: new screens live in `apps/admin/app/(panel)/<route>/{page.tsx,actions.ts}`; money actions use `openGate({ path, rate: RATE.money, stepUp: true })`, zod `.strict`, re-read before write, audit (`apps/admin/app/(panel)/przychody/actions.ts:30-60`); existing screens: `przychody` (revenue, disputes, refunds), `ustawienia`, `spolecznosc`, `tresci`. Admin apps must import modules only through index (`scripts/check-architecture.ts`; CLAUDE.md §3, §4.20). Panel `admin.env` lacks `STRIPE_SECRET_KEY` except a restricted `rk_live_` key for refunds/disputes and lacks `RESEND_API_KEY` (STATUS.md:45), so admin-originated e-mail/Stripe reads need env additions.
- Revenue/reporting: `lib/modules/admin-revenue/queries.ts` (`getRevenueOverview`, `listDisputes`, refunds list; `toCsv` from `lib/modules/shared/csv`; `MAX_ROWS = 50_000`; `REVENUE_STATUSES` from admin-overview; amounts converted to PLN via `minorToPln`).
- Audit: `recordAuditEvent(ctx, {action,targetType,targetId,metadata}, tx)` (`lib/modules/audit/application/record-audit-event.use-case.ts`), best-effort variant `recordAuditEventSafe`; metadata must be ids/counters/statuses, never secrets or content (CLAUDE.md §4.20). `AuditLog` columns `schema.prisma:244-262`.
- E-mail: texts in `lib/email-defaults.ts` (slug→content), registry `lib/modules/email/domain/email-template-registry.ts`, send helpers `send-transactional-email.use-case.ts`; only PL/EN (CLAUDE.md §4.11/§4.18); provider chain SES/Resend/Postmark (§4.18). The email module test forbids mutating `payment`/`patronGrant` models from the e-mail module (`tests/unit/modules/email/forbidden-mutations.test.ts`).
- Cron: nine timers (CLAUDE.md:240+ §6); new job = route + `deploy/serwerek/systemd/polutek-cron-<name>.timer` + row in `docs/operations/SERWEREK.md` table (SERWEREK.md:259 area). Existing reconciliation extension point `app/api/cron/stripe-reconciliation/route.ts`.
- Telemetry: anonymous, cookieless; never user id/IP/UA (CLAUDE.md §4.19); analytics numbers come from aggregates, "no measurement = null, never 0" (§4.20 Analityka).
- GDPR/retention: account deletion anonymises the user and *keeps* `Payment` and `AuditLog`; Stripe Customer PII erased by queue (`stripe-customer-anonymization.use-case.ts`; `retention` cron); Privacy Policy text says payments are kept "as long as tax law requires" (`LegalDocs.tsx:211`, `:417`). `export-own-data.use-case.ts:49` includes the user's payments in the data export.
- Under Managed Payments Stripe itself deletes PII from its objects on customer request (How it works) → our own `Order` snapshot becomes the only durable tax record there.

### Inferences — design
1. **Tax report**: `getTaxReport(ctx, {from,to})` in a new `lib/modules/admin-revenue` function: group `Order` (status PAID/REFUNDED/PARTIALLY_REFUNDED) by `taxCountry`, `currency`, rate, `buyerIsBusiness`; columns: net, tax, gross, refunds (negative), count; CSV via `toCsv` + page tab "VAT" in `przychody`. Treat Stripe Tax reports/Managed Payments reports (`withheld_tax`) as the authoritative filing source and our export as the reconciliation/evidence copy; add a monthly reconciliation job that compares our totals with Stripe balance reports (manual in phase 1).
2. **Admin screens** (new `dostepy/` route + tabs in `przychody`): entitlements list/filter by user/email/source/state; grant (reason ≥ 3 chars, optional validUntil) and revoke; order detail with waiver evidence, tax snapshot, link to Stripe objects; refund = existing `refundAction` (works on the `Payment` row; after success entitlement is revoked by the shared refund path); price & product settings (`ustawienia`): active flag, price table, Stripe price ids.
3. **Audit actions** (new names, same pattern as `PATRON_GRANTED/REVOKED`): `ORDER_CREATED`, `ORDER_PAID`, `ORDER_REFUNDED`, `ORDER_DISPUTE_OPENED/CLOSED`, `ENTITLEMENT_GRANTED`, `ENTITLEMENT_REVOKED`, `ENTITLEMENT_RESTORED`, `PURCHASE_WAIVER_MISSING` (alert). Metadata: ids, scope, source, amounts, country code; never e-mail or VAT-ID.
4. **E-mails** (PL/EN; new slugs `access-granted`, `purchase-refunded`): content incl. product, gross/tax amounts, date, waiver text + link to Terms (durable-medium confirmation), how to get support; invoice/receipt link when available. Under Path C, Stripe/Link sends receipt+invoice, so ours is only the "access active" mail. Sent after commit (pattern `fulfill-payment.use-case.ts:107-152`); failure audited, never rolls back access.
5. **Cron**: extend `stripe-reconciliation` (same 15-min timer): PENDING `Order`s older than 15 min → `checkout.sessions.retrieve`; paid → `fulfillPurchase`; expired → `EXPIRED`; plus the existing refund pass already covers `Payment(kind=PURCHASE)` because it iterates payments. Add `abandon-stale-orders` behaviour to the same route rather than a new timer (fewer ops changes).
6. **Telemetry**: beacon events only for funnel steps without identity (`purchase_dialog_opened`, `purchase_redirected`), country from existing aggregate fields; completed purchases are counted from `Order` aggregates into the Analytics roll-ups (as with tips), "bez pomiaru" when the beacon is off. No order/user ids in `POST /api/t`.
7. **Retention / account deletion**: policy proposal: (a) on deletion, `Entitlement` stays but is inert (`User.isDeleted` → `DELETED`, `check-video-access.use-case.ts:128`); (b) `Order` rows kept for the statutory period; `buyerEmail` replaced by tombstone address (as `anonymizeEmailHistory` does for email history), `buyerTaxId` retained only if the accountant requires it, `taxJurisdiction`/amounts retained; (c) extend `export-own-data` with the user's orders (own data, no other people's); (d) deletion UI warns that lifetime access is lost and not refundable by deletion (consumer-facing text, legal review); (e) Privacy Policy gets a purchase-record retention line (10-year figure in the brief is *not verified here*; accountant decides) and `legal-docs-consistency.test.ts` updated.

### Gaps
- The statutory retention period and which fields must be retained (invoice data) were not researched here.
- Whether an *individual* seller must issue invoices to B2C buyers (and numbering) is outside this note.
- Exact `restricted key` permissions needed in `admin.env` for reading Checkout sessions/tax objects.

---

## 6. Security

### Takeaway
Reuse the webhook hardening already in place (signature on raw body, livemode check, `StripeEvent` lock, idempotent CAS), make entitlement checks always read the DB (no cache), keep `media-source` uncached, shorten delivery-token TTL for PAID videos because tokens are bearer and cannot be revoked, and add a soft concurrent-stream limit using `VideoPlaybackSession`. Biggest new risks are fail-open tier mapping during rollout and un-user-bound tokens.

### Cited Findings
- Webhook: `Stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`, mode mismatch ignored, `acquireLock` returns `ALREADY_PROCESSED|CONFLICT`, non-2xx → Stripe retries (`handle-stripe-webhook.use-case.ts`); route reads raw body once (`app/api/webhooks/stripe/route.ts`); `/api/webhooks(.*)` is public in middleware (`middleware.ts:67`) and authenticated by signature only.
- Idempotency patterns: PaymentIntent create with `idempotencyKey: payment-intent-<id>` (`create-checkout-intent.use-case.ts:142-144`), CAS updates, `StripeEvent` PK = event id.
- Never cache plans: CLAUDE.md:84-90 (§4.3), route returns `private, no-store` (`app/api/media-source/[videoId]/route.ts`), client plan cache is in-memory per viewer (`PremiumWrapper.tsx` `preloader.getPlaybackPlan`).
- Token: bearer, 6 h, no user binding, Worker checks only HMAC+exp (`self-hls-token.service.ts:14,47-63`; `workers/hls-edge/worker.mjs:1-24`); sign accepts `ttlSeconds` (`:50-58`). Token renewal exists in the player: `app/components/player/usePlaybackTokenRenewal.ts:67-82` (`RENEW_BEFORE_EXPIRY_MS`), `VideoPlayer.tsx:100-153`.
- Playback sessions: `VideoPlaybackSession` has `userId`, `ipHash`, `userAgentHash`, `lastHeartbeatAt`, heartbeat every 60 s, max age 24 h (`schema.prisma:1261-1283`; `lib/modules/video/domain/video.dto.ts:324-333`), session reuse rules in `self-hls-plan.ts:84-107`.
- Stripe can itself refund within 60 days and accept disputes under Managed Payments (How it works), so entitlement state can change without admin action.
- Rate limiting precedent: Redis-backed `rateLimit` per user on create-intent (10 per 10 min) and media-source (60/min) (`app/api/checkout/create-intent/route.ts`, `media-source/.../route.ts`).

### Inferences — controls
1. **Webhook**: add `checkout.session.completed|async_payment_succeeded|async_payment_failed|expired` to `dispatchEvent`; verify `session.mode==="payment"`, `payment_status`, `metadata.orderId == client_reference_id`, Order exists with matching `userId` and `providerSessionId`, `currency`/`productCode` equal to the order, `amount_total >= price floor` (tampering/coupon abuse), livemode. Mismatch → alert + throw (Stripe retries; operator investigates), never grant.
2. **Idempotency**: `Order.providerSessionId @unique`, CAS `PENDING→PAID`, partial-unique active entitlement, `StripeEvent` lock. Duplicate payments (two tabs): second `Order` is PAID with entitlement already active → mark `needsRefund` alert for admin, do not create a second entitlement.
3. **Entitlement freshness**: `checkVideoAccess` reads the DB on every plan request; never place entitlement state in cached JSON, in the session cookie or the Better Auth cookie cache (CLAUDE.md §4.5: session is identity only). After purchase/refund, client drops cached plans via full reload (as tips do).
4. **Refunded/charged-back buyers**: revocation happens inside the same transaction as the refund total update (extend `applyRefundedTotal`, `handleDispute`), plus the 15-min reconciliation pass; residual exposure = outstanding HLS token TTL. Reduce with `ttlSeconds` 15–30 min for `tier=PAID` (the player already renews: `usePlaybackTokenRenewal.ts`), at the cost of more `/api/media-source` calls (rate limit 60/min is ample).
5. **Account sharing (soft)**: at plan issuance for PAID, count the user's distinct playback sessions with `lastHeartbeatAt > now-2.5min` and different `ipHash`; above N (e.g. 3) → deny with a neutral state + alert, not silent. Keep it advisory; hard DRM is out of scope (Worker docs state this is access control, not DRM). Also keep `rateLimit` per user.
6. **Abuse of checkout creation**: require verified e-mail (`emailVerified`) and non-deleted user, per-user and per-IP rate limits (`rateLimit`), Turnstile on the dialog if bots appear (pattern in auth), and cap open Orders per user.
7. **Secrets/PII**: `STRIPE_SECRET_KEY` is in `app.env` only; no new secret for Path A/C; Path B adds provider API key and webhook secret to `app.env` (§8.1 rules). Don't log VAT-IDs; `StripeEvent.payload` already stores only a reduced object (`handle-stripe-webhook.use-case.ts` lock payload: id/type/created/livemode/object).
8. **CSRF/public routes**: new `POST /api/purchase/*` stays behind session cookie (not in `isPublicRoute`), `/api/user/*` CSRF check does not apply (not under that prefix), so add an Origin check in the handler or place under a guarded prefix.
9. **Rollback hazard**: see §1 point 3 (older image maps PAID→LOGGED_IN).

### Gaps
- No load/abuse data on real traffic; the concurrency threshold N is a placeholder.
- Cloudflare Worker cannot revoke individual tokens without a KV deny-list (not designed here; possible with Workers KV keyed by `userId`/`orderId` if immediate revocation is required, but tokens carry no user id today).

---

## 7. Rollout plan, effort, tests, owner decisions

### Takeaway
Seven phases, each independently deployable and flag-gated; code lands dark before any price exists. Rough total: 3–5 engineer-weeks of agent time plus external legal/tax work that gates launch. The existing "one heavy command at a time, no GitHub Actions, local CI" constraints (CLAUDE.md §0/§9) apply.

### Cited Findings (process constraints in repo)
- Changes go through PR + `SKIP_CI=1 bash scripts/ops/mergedeploy.sh <PR> <branch> <prefix> [--no-deploy]`; production changes (deploy, DB, Stripe, DNS) only with explicit owner approval in chat, one approval per action (CLAUDE.md:15-20, §0; `docs/operations/SERWEREK.md` rozdz. 12).
- Verification: `npm run quality`, `quality:hotspots`, `admin:build && build`, `node scripts/ops/local-ci.mjs [--full]`, `npx tsc --noEmit` (CLAUDE.md §9).
- Temporary flags must be registered in CLAUDE.md §0 and removed afterwards (CLAUDE.md §0 last bullet).
- Legal docs: bump `LEGAL_DOCUMENTS_VERSION` on any change (`lib/legal/version.ts:1-7`; `docs/architecture/i18n-and-legal.md`); PL/EN documents must be literal translations; consistency test.
- Destructive/enum migrations: two-step deploy and pre-deploy dump (CLAUDE.md §4.0).
- Stripe has test mode/sandbox; webhook `livemode` guard already exists; Managed Payments sandbox sends no receipt e-mails automatically ([Set up](https://docs.stripe.com/payments/managed-payments/set-up)).

### Inferences — phased plan

| Phase | Content | Gate / flag | Effort |
|---|---|---|---|
| **0. Decisions & legal** (no code) | Owner decisions (below); accountant: seller status (a private person selling digital content worldwide), VAT/OSS, invoices, record retention; lawyer: Terms/Privacy, waiver wording, refund policy, PL consumer law; pick path A/B/C; Stripe eligibility check for Managed Payments (ask Stripe) | G0: written owner decision in chat + updated "Decyzje właściciela" in STATUS.md and CLAUDE.md §0/§1/§4.1/§4.4/§4.10/§4.14 | S (calendar-bound) |
| **1. Dark foundations** | Migrations: `PaymentKind`/`Payment.kind default TIP`, `Order`, `Entitlement`, `ProductPrice`, `AccessTier.PAID` (own migration); `lib/access-tier.ts`, `check-video-access` branch, `PURCHASE_REQUIRED` reason/state, DTO/sidebar/admin-reader updates, tip-reader `kind: TIP` filters, new modules `lib/modules/entitlements` and `lib/modules/purchases`; architecture-gate allowlist; tests (matrix, readers, PG constraints); docs. Admin radio for PAID *not* exposed. | none visible; `PURCHASES_ENABLED` env default off (register as TEMP flag in CLAUDE.md §0) | **M–L** |
| **2. Checkout in Stripe test mode** | `POST /api/purchase/checkout`, `GET /api/purchase/[orderId]`, `fulfillPurchase`, webhook events, return page, `PurchaseDialog`, waiver capture, e-mails `access-granted`, `AccessLockOverlay` CTA, i18n in 8 languages, CSP check, reconciliation extension, audit | test-mode keys on a non-prod env or `livemode` guard; flag on for owner account only (allowlist by `User.id` in an `AppSetting`) | **L** |
| **3. Admin & reporting** | `dostepy` screen (grant/revoke/search), `przychody` tabs (Zakupy, VAT), CSV tax export, price/product settings, order detail with evidence, panel `admin.env` additions | admin deploy via `deploy-admin.sh` | **M** |
| **4. Hardening** | PAID token TTL, concurrent-stream guard, rate limits, duplicate-payment handling, dispute suspend/restore tests, data export + deletion rules, retention text, telemetry funnel, load test per `docs/operations/LOAD-TEST.md` | | **M** |
| **5. Legal docs + soft launch** | Terms/Privacy PL/EN rewrite of §1.2, §2.1, §4 (sale vs tip), bump `LEGAL_DOCUMENTS_VERSION`, `legal-docs-consistency` test update, STATUS/CLAUDE.md updates; live mode with one real purchase by owner (STATUS.md:80-82 P0 steps: webhook endpoint/events/`whsec_`/restricted key); refund drill; then public | owner approval per production action | **S** (+ external) |
| **6. Optional later** | Guest checkout + claim, gifting, promo codes, B2B VAT-ID, per-video/series scope, regional prices, retire tips | | each **M** |

**Test strategy** (repo conventions: Vitest unit + `tests/postgres` + source-reading tests; Stripe never called in tests, per `przychody/actions.ts` header):
- Unit: tier helpers; access matrix; `fulfillPurchase` (replay, out-of-order, wrong amount/currency/user, `no_payment_required`, async failed); refund/dispute revoke/restore (copy structure of `tests/unit/modules/payments/*` and `fake-payments-db.ts`); webhook dispatch; waiver validation; price floor.
- Source-reading: all tier readers handle PAID; every `payment.*` query is kind-aware; no `PatronGrant` import in `lib/modules/access`; no entitlement in public DTOs; AccessLockOverlay CTA test rewritten to "PURCHASE_REQUIRED shows buy CTA; LOGIN_REQUIRED still shows login".
- Postgres: migration additive, enum value usable, partial unique index prevents duplicate active entitlements, FK behaviour on user tombstone.
- E2E/manual in Stripe test mode with test cards (3DS, declined, BLIK if enabled), CLI `stripe trigger checkout.session.completed`/`charge.refunded`/`charge.dispute.created`, and a full refund drill; verify (a) access appears after webhook and via fast path, (b) revoked on refund, (c) `media-source` never cached, (d) another account on same browser doesn't inherit plans.
- Visual: `tests/visual` for the dialog and overlay in PL/EN.

**What the owner must decide** (each blocks a specific phase):
1. Whether to reverse the non-commercial model at all, and what happens to tips (keep / retire) — gate G0.
2. Product & price: one all-access lifetime price vs per-video vs bundles; amount per currency (PLN/EUR/USD/CHF/GBP) incl. or excl. tax; launch promo; regional pricing yes/no.
3. Meaning of "lifetime": lifetime of the user's account, of the creator's catalog, or of the service; what if the service closes or content is removed; access to *future* videos included? (drives Terms and refund exposure).
4. Scope: which videos are PAID vs PUBLIC/LOGGED_IN; are comments readable/writable for non-buyers; does a buyer get any badge (CLAUDE.md §4.9 says no public supporter badge).
5. Refund policy: statutory 14-day right vs waiver (and what the product copy promises), partial refunds, chargeback policy, goodwill window; who handles support (support@pawelperfect.com).
6. Merchant model: Stripe Tax (you are the seller: registrations, filings, invoices) vs Stripe Managed Payments (higher cost, Stripe/Link is seller; eligibility review) vs third-party MoR (new processor, new webhooks, new legal text); willingness to register a business/VAT status as a private person (accountant).
7. Gift purchases, guest checkout, business/VAT-ID purchases: in or out of v1.
8. Account-deletion consequences for lifetime buyers and data retention period for purchase records.
9. Launch region exclusions (sanctioned countries; Managed Payments excludes CN, CU, IR, KP, RU, SY etc.) and languages of Terms (only PL/EN exist; other languages show English documents per `i18n-and-legal.md`).
10. Budget acceptance: Path C fee (~3.5% on top of Stripe fees per third-party source), Stripe Tax fees, accountant/lawyer cost (CLAUDE.md STATUS "Nic za pieniądze na tym etapie" decision, STATUS.md:120).

### Gaps
- Effort figures are my estimates from file counts and the repo's conventions, not measured.
- Not researched: Lemon Squeezy/Paddle seller eligibility for individuals; VAT/OSS thresholds and obligations for a Polish private person; Polish record-retention law; Stripe Tax pricing; Managed Payments sandbox behaviour for `custom_text`/`consent_collection`.
- Not verified against production: Stripe account mode, existing webhook configuration, Tax registrations, DB state.

---

## Appendix A: files to create / touch (checklist for the implementing agent)

New: `lib/modules/entitlements/{domain,application,infrastructure}/*` (+`index.ts`), `lib/modules/purchases/{domain,application,infrastructure}/*` (create session, fulfil, status, reconcile, tax report), `app/api/purchase/checkout/route.ts`, `app/api/purchase/[orderId]/route.ts`, `app/api/purchase/prices/route.ts`, `app/components/purchase/*`, `apps/admin/app/(panel)/dostepy/*`, migrations (`..._add_access_tier_paid`, `..._orders_and_entitlements`), email defaults + templates, docs `docs/architecture/paid-access.md`.

Touch: `prisma/schema.prisma`; `lib/access-tier.ts`; `lib/modules/access/**`; `lib/modules/playback/**` (reason/state, ttl); `lib/modules/payments/application/{fulfill-payment,handle-refund,handle-dispute,handle-stripe-webhook}.use-case.ts`, `supporter-grant.ts` (kind guards); money readers listed in §0; `lib/modules/channel/application/channel-layout.service.ts`; `lib/modules/video/domain/video.dto.ts`; `app/types/video.ts`; `app/components/{PremiumWrapper,AccessLockOverlay,Hero,ChannelVideoCard}.tsx`; `app/components/channel/{SidebarPlaylist,sidebar-layout-request}.ts(x)`; `middleware.ts` (only if guest checkout); `lib/utils/security.ts` (CSP only for path B or embedded checkout); `lib/legal/version.ts`, `app/components/legal/LegalDocs.tsx`; `lib/i18n/catalog/*.json`; `app/api/cron/stripe-reconciliation/route.ts`; `apps/admin/app/(panel)/{przychody,ustawienia,tresci}`; `apps/admin/components/content/{film-form,new-film-form}.tsx`; `lib/modules/admin-community/domain/access-explanation.ts`; `scripts/check-architecture.ts` (allowlist); tests listed in §0; `CLAUDE.md` §0, §1, §4.1, §4.2, §4.4, §4.10, §4.14, §6, `docs/operations/STATUS.md` (owner decisions), `docs/architecture/payments-and-tips.md`, `docs/architecture/i18n-and-legal.md`, `schema.prisma:481-482` stale comment.
