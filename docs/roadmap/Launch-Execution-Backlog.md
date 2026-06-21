# Launch Execution Backlog

Status: ACTIVE
Purpose: non-executable launch backlog summary
Current executable source: docs/tickets/ready/README.md
Launch status: NO_GO

This document is not an executable queue. Only `docs/tickets/ready/README.md` may identify the current executable ticket.

## Grouped code queue after current-main review

| Order | Workstream | Ticket / state | Notes |
| ---: | --- | --- | --- |
| 1 | Video provider lifecycle | `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001 / DONE` | Grouped Cloudflare admin media lifecycle, legacy import UI, upload/attach lifecycle, sync/webhook reconciliation and truthful admin states. |
| 2 | Video state contract | `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001 / DONE` | Completed publication, auto-publish, `publishedAt`, hero, sidebar and archive/unpublish transitions through the state-contract ticket. |
| 3 | Playback/access cleanup | `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001 / DONE` | Completed playback/access cleanup and legacy fallback retirement in PR #994. |
| 4 | Payments code hardening | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001 / DONE` | Code hardening implemented via PR #998; payment-to-PatronGrant operator smoke evidence remains separate. |
| 5 | CI/test/control-plane signal | `CI-SIGNAL-RECONCILIATION-002 / DONE` | Architecture audit follow-up: real test-suite signal, strict-escapes baseline drift, hotspots, masterplan risk accuracy. |
| 6 | Payment webhook actor context | `PAYMENTS-WEBHOOK-SYSTEM-ACTOR-001 / CURRENT` | P0 blocker: Stripe webhook fulfillment must use an explicit system actor before payment-to-PatronGrant flow can be treated as launch-green. |
| 7 | Admin auth/channel diagnostics | `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001 / NEXT` | Regression coverage, production-safe admin diagnostics, and admin wrapper consistency review after the payment webhook actor fix. |

## Architecture audit findings routed

Important findings from `docs/reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md` are routed as follows:

| Finding | Owner |
| --- | --- |
| CI/test signal scope gap | `CI-SIGNAL-RECONCILIATION-002` |
| strict-escapes baseline drift | `CI-SIGNAL-RECONCILIATION-002` |
| admin video page hotspot | `CI-SIGNAL-RECONCILIATION-002` |
| masterplan CI-risk accuracy | `CI-SIGNAL-RECONCILIATION-002` |
| payments metadata-user source-of-truth | active payments ticket |
| payments request-id idempotency | active payments ticket |
| Stripe webhook AppContext missing explicit system actor for PatronGrant mutations | `PAYMENTS-WEBHOOK-SYSTEM-ACTOR-001` |
| dead legacy payments services | payment webhook actor ticket or later cleanup if still unused |
| admin auth wrapper consistency | `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` after `PAYMENTS-WEBHOOK-SYSTEM-ACTOR-001` |
| playback `getGatedMedia` footgun | already playback-domain evidence; only revisit if PR #994 did not resolve it |

## Historical or superseded runtime tickets

The following old cards are retained as background evidence but should not be used as direct prompts while the grouped queue exists: `COMMENTS-PRODUCTION-UX-API-CONTRACT-001`, `ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001`, `ADMIN-VIDEO-CLOUDFLARE-CONTAINMENT-001`, `ADMIN-VIDEO-TUS-UPLOAD-LIFECYCLE-001`, `X3-FIX-006`, `X3-FIX-008`, `ADMIN-VIDEO-PUBLICATION-AND-HERO-CONTRACT-001`, `LEGACY-ACCESS-POLICY-RETIREMENT-001`, `LEGACY-MEDIA-PROXY-RETIREMENT-001`, `ADMIN-AUTH-POSTMERGE-REVERIFY-001`, and `ADMIN-CHANNEL-ROOT-CAUSE-001`.

## Non-code evidence remains separate

Vercel, Cloudflare and Stripe production smoke/evidence tickets remain operator work and must not be mixed into code prompts unless a new code defect is identified. The current Stripe webhook system-actor blocker is a code defect and must be fixed before payment-to-PatronGrant can be treated as launch-green.

## Continuing launch backlog

Legal/privacy/cookies/support copy remains `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`. Remaining non-code and evidence work includes Email consent boundary, Signed unsubscribe, Bounce/complaint suppression, System email events, Language persistence, Referral notifications, Runtime/provider privacy inventory, Legal copy PL/EN, Vercel production evidence, Stripe production evidence, Cloudflare production evidence, Backup, restore and alerts, X6.2, X6.3, X6.4, X6.5, X6.6, X6.7, X6.8, X6 certification, X7 Launch Evidence Pack, X7 certification, and Final owner launch decision. Public launch remains `NO_GO`.
