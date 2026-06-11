# Research Synthesis DR-01–DR-10

Status: STAGED ONLY — NIEAKTYWNE. X0.5 ma po aktywacji przekształcić tę syntezę w aktywne standardy, specs i backlog.

## DR-01 Masterplan

Produkt wymaga pełnego masterplanu obejmującego single-creator VOD, patron model, access tiers, provider wideo, player/locked states, admin cockpit, comments/community, email/newsletter, observability/support, privacy/security/legal/accessibility, launch readiness i AI/Codex execution model.

Każda rzecz musi być sklasyfikowana jako: launch-critical, should-have, post-launch, do-not-build albo owner decision required.

## DR-02 Payments / Patron Safety

Stripe Checkout dla jednorazowego support/donation, server-side minimum amount validation, raw body signature verification, idempotency, StripeEvent ledger, Payment jako financial fact, PatronGrant przez domain use-case, brak grantu poniżej progu, duplicate webhook bez duplicate grant, full refund revokes, partial refund policy explicit, dispute suspends, dispute won reactivates, dispute lost/chargeback revokes, manual grants reason + audit.

## DR-03 Access / Patron Hard Reset

Deny by default, backend validates every sensitive request, active PatronGrant is truth, Subscription never grants access, Clerk metadata UI/cache only, User.isPatron legacy, denied PlaybackPlan no token/source, no provider call on denial, admin override explicit and audited, Access module centralizes decisions.

## DR-04 Video Provider

Cloudflare Stream first, Mux supported by thin abstraction, provider per VideoAsset, Video owns content metadata, VideoAsset owns provider/media state, direct browser upload, resumable upload, provider processing states/webhooks, signed/private playback, primary READY asset drives playback, no active R2/S3 fallback, migration path for originals, admin media cockpit.

## DR-05 PlaybackPlan / Player

Player renders backend PlaybackPlan. Frontend does not decide access. Locked state is separate render tree. No player mount under locked overlay. No tracking until real playback starts. Admin preview excluded from public analytics. Mobile/accessibility/player UX, captions/subtitles, resume/progress later.

## DR-06 Admin Cockpit

Admin cockpit is support operations center. Access Diagnostics first. Paid-but-locked must be answerable. Admin sees identity, PatronGrant history, payments, refunds, disputes, subscription, Clerk mismatch, final access decision and video asset status. Corrective actions require reason + audit.

## DR-07 Comments

Comment visibility != permission. Comments visible to everyone under all published tiers. PUBLIC/LOGGED_IN commenting requires login. PATRON commenting requires patron/admin. Guests read but do not write/report. Spoiler report reason, moderation states, no shadow bans, rate limiting, duplicate detection, moderation queue, audit for moderation actions, single-level replies launch, editing deferred.

## DR-08 Email

Subscription = mailing consent only. Patron != subscriber. Unsubscribe never removes patron access. Patron does not imply marketing consent. Transactional separated from marketing. Broadcast preview/test-send, delivery webhooks, bounce/complaint suppression, PL/EN templates, preference center target, admin broadcast audit.

## DR-09 Observability

Owner health dashboard, admin support diagnostics, developer observability, audit trail separate from logs, privacy-safe analytics, no secrets/tokens in logs, webhook states visible, stuck events visible, payment/patron health, access mismatch detection, video/provider health, playback errors, email health, comments health, paid-but-locked workflow, critical alerts, admin preview excluded.

## DR-10 Launch Readiness

Public launch readiness. Access leak, payment fulfillment gap and privacy/legal gaps are launch blockers. Unsubscribe and consent required. Mobile/accessibility/performance required. Admin must diagnose paid-but-locked. Backup/recovery/runbooks, security review, manual QA, owner runbook and final X7 certification.

## Embedded owner decisions

Decyzje właściciela, wiążące dopóki właściciel jawnie ich nie zmieni:

- Patronat nie jest subskrypcją cykliczną.
- Patronat jest nagrodą za kwalifikujące jednorazowe wsparcie/donację.
- Dostęp patrona jest permanentny/lifetime/no-expiry domyślnie, chyba że zostanie zawieszony lub cofnięty polityką.
- Próg kwalifikującego wsparcia jest admin-konfigurowalny per waluta; domyślne wartości launch: 10 PLN, 10 USD, 10 EUR, 10 CHF.
- Cloudflare Stream jest pierwszym providerem wideo.
- Mux ma być wspierany projektowo per `VideoAsset`, bez budowania ciężkiego enterprise multi-provider frameworka.
- R2/S3/Vercel Blob mogą istnieć jako legacy/migracja, ale nie są aktywnym bezpiecznym providerem prywatnego playbacku patronów bez przyszłej decyzji architektonicznej.
- Komentarze pod patron-only wideo są widoczne dla wszystkich; komentowanie/reagowanie/pisanie wymaga patrona lub admina.
- Launch jest publiczny, nie prywatna beta.
- Cel jakości: produkt excellent, nie szybkie minimum; excellence osiągane fazami i ticketami, nie jednym wielkim PR-em.
