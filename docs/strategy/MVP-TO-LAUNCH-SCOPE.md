# MVP to Launch Scope

Status: ACTIVE CURRENT STATE — living launch scope, not historical control-plane backlog.

## Executive summary

Launch Polutek.pl jest publiczny, nie private beta. MVP-to-launch oznacza
najmniejszy publicznie bezpieczny, supportowalny i excellent-enough zakres,
który respektuje product DNA:

- single-channel VOD jednego twórcy;
- brak marketplace/multi-tenant;
- brak subskrypcji cyklicznych;
- dożywotni patron access przez kwalifikujący jednorazowy tip Stripe;
- `PatronGrant` jako jedyne źródło prawdy dla patron access.

Runtime foundations są po stabilizacji. Dokumentacja, zielone CI ani preview
nie certyfikują jednak launchu same w sobie. Public launch wymaga jeszcze
owner/legal/operator evidence, manualnego smoke proof i finalnej decyzji
właściciela. Ten zakres jest śledzony w GitHub issue #1269 i powinien być
rozbijany na małe tickety tylko wtedy, gdy wymaga zmian w kodzie.

## Launch-critical — current scope

| Obszar | Wymaganie | Status |
|---|---|---|
| Patron source of truth | Backend access/status czyta aktywne `PatronGrant`; legacy `User.isPatron`, `User.patronSince`, `User.patronSource` nie istnieją. | IMPLEMENTED — keep regression tests and docs current |
| Payment fulfillment | Stripe success path przechodzi przez `fulfillPayment()`; duplicate webhook/retry nie tworzy duplicate grant. | IMPLEMENTED — verify in release smoke |
| Refund/dispute lifecycle | Full refund/lost dispute cofa lub zawiesza access zgodnie z aktywną polityką; partial refund wymaga świadomej decyzji/policy. | NEEDS OWNER/LEGAL CONFIRMATION before final launch evidence |
| Playback security | Denied `PlaybackPlan` nie zawiera playable URL/token/provider secret i nie montuje playera. | IMPLEMENTED — launch blocker if regressed |
| Cloudflare Stream baseline | Cloudflare Stream jest primary managed video providerem; signed playback fail-closed for private/patron sources. | IMPLEMENTED — verify provider/live webhook evidence |
| Admin diagnostics | Owner/admin może zdiagnozować paid-but-locked, access decision, provider failure i payment/webhook state bez ręcznej edycji DB. | IMPLEMENTED/PARTIAL — verify manually in production/staging |
| Comments safety | Public read; write/react/report gated and rate-limited according to current product policy. | IMPLEMENTED/PARTIAL — verify abuse/rate-limit smoke |
| Email consent | Subscription/follow nie daje patron access; unsubscribe nie cofa `PatronGrant`; signed unsubscribe must work without login. | IMPLEMENTED/PARTIAL — legal/suppression evidence still required |
| Observability/support | Critical failures for billing/access/video/email/comments are diagnosable without leaking secrets/tokens. | PARTIAL — evidence tracked in #1269 |
| Legal/privacy/cookie/refund/support copy | Public copy approved by owner/legal before launch traffic is invited. | OWNER/LEGAL REQUIRED — tracked in #1269 |
| Backup/restore/ops | RPO/RTO decision, restore drill, alert channels/thresholds, production evidence. | OWNER/OPERATOR REQUIRED — tracked in #1269 |
| Manual QA / X6/X7 proof | Mobile, accessibility, performance, security, smoke and representative validation evidence. | REQUIRED BEFORE FINAL LAUNCH DECISION — tracked in #1269 |

## Should-have before or shortly after launch

| Obszar | Wymaganie | Czy blokuje launch? |
|---|---|---|
| Cache/ISR for anonymous home/watch | Biggest scalability lever; must not mix user-specific access into static output. | Not if expected launch traffic is small and owner accepts current capacity |
| R2 thumbnail migration | Reduce Vercel Blob/function/egress cost for custom thumbnails. | No — active executable ticket is `docs/tickets/ready/MEDIA-THUMBNAILS-R2-MIGRATION-001.md` |
| Admin video studio polish | Better single place for status, sources, thumbnail, subtitles, SEO, diagnostics and publication. | No, unless a missing state blocks support-critical operations |
| Caption workflow polish | Current baseline is WebVTT URL fields; managed upload/validation can be added later. | No, unless owner/legal requires captions for launch |
| External embed UX polish | YouTube/Vimeo should keep provider-specific UX and preserve patron safety constraints. | No for Cloudflare-first launch |
| SEO/video metadata polish | Better `VideoObject`, sitemap, provider-aware metadata. | No, unless launch acquisition depends on SEO immediately |
| Performance budgets | Keep budgets for launch-critical flows; do not weaken access correctness for performance. | Only if manual performance gate fails |

## Post-launch

| Obszar | Dlaczego po launchu |
|---|---|
| Watch history / continue watching | Useful product layer, not required for safe first public launch. |
| Advanced analytics | Needs real traffic and clear privacy stance. |
| Advanced provider orchestration | R2 original/master + multi-provider mirroring is valuable, but not required for Cloudflare-first launch. |
| Community expansion | Edit comments, richer reactions, deeper profiles/threads can expand scope and should be controlled. |
| Advanced dashboards | Admin diagnostics and critical health matter more before launch than richer analytics. |

## Owner questions before final launch decision

| ID | Question | Required before |
|---|---|---|
| OQ-001 | What exact partial refund policy applies to patron access? | Payment/legal proof |
| OQ-002 | What exact PL/EN legal/privacy/cookie/refund/support/community copy is approved? | Legal launch proof |
| OQ-003 | What alert channels, owners and thresholds are approved for billing/access/video/email/comments failures? | Observability proof |
| OQ-004 | What owner-approved RPO/RTO applies to production data and media-supporting state? | Backup/recovery proof |
| OQ-005 | What captions/subtitles scope is required for launch VOD? | Accessibility/legal proof |
| OQ-006 | What physical device/browser baseline must pass manual QA? | Mobile/browser proof |
| OQ-007 | Is the proposed stabilization window accepted after launch, and who owns incidents? | Post-launch operations |
| OQ-008 | What level of risk-based security verification is required beyond current CI/security gates? | Security proof |

## Launch blockers

- Access leak or playable URL/token/provider secret in denied `PlaybackPlan`.
- Player mounted under overlay for locked content.
- Provider call, token request or stream fetch before backend Access allow.
- Patron access based on `User.isPatron`, Clerk metadata, `Subscription`, Payment alone, Stripe state alone or frontend state.
- Stripe webhook without raw-body signature verification or idempotent event ledger.
- Duplicate grant on webhook retry.
- Below-threshold payment creates access.
- Full refund/lost dispute does not revoke/suspend access according to the active policy.
- Unsubscribe revokes `PatronGrant` or patron status creates marketing consent automatically.
- Missing logged-out signed unsubscribe path before broadcast.
- Missing owner/legal approval for public legal/privacy/cookie/refund/support copy.
- Logging secrets, playback tokens or private media URLs.
- Missing production/manual evidence for smoke, backup/recovery, observability, accessibility/mobile/performance/security before final launch decision.

## Non-blockers

- No marketplace/multi-creator/multi-tenant features.
- No recurring patron subscription.
- No heavy enterprise video provider framework if Cloudflare baseline is stable.
- No full R2 original/master mirroring architecture before first launch.
- No advanced Mux analytics/4K/DRM.
- No resume/progress product layer.
- No edit comments, deep threads, profiles or richer reactions unless owner marks them launch-critical.
- No generic owner dashboard if critical diagnostics and health checks are enough for support.

## Documentation rule

Do not reintroduce historical control-plane roadmaps, reconciliation reports or
large multi-agent queues. If a current-state conclusion belongs in docs, update
`CLAUDE.md`, `KNOWN_LIMITATIONS.md`, this file or `docs/audit/`. If it is work
to execute now, create one small file in `docs/tickets/ready/` or update the
matching GitHub issue.
