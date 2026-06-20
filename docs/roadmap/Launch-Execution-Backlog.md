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
| 4 | Payments code hardening | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001 / DONE` | Completed Stripe fulfillment, idempotency and PatronGrant hardening in PR #996. |
| 5 | CI/test/control-plane signal | `CI-SIGNAL-RECONCILIATION-002 / CURRENT` | Current executable architecture-audit follow-up: real test-suite signal, strict-escapes baseline drift, hotspots, masterplan risk accuracy. |
| 6 | Admin auth/channel diagnostics | `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001 / PLANNED_AFTER_CI_SIGNAL_RECONCILIATION` | Regression coverage, production-safe admin diagnostics, and admin wrapper consistency review. |

## Architecture audit findings routed

Important findings from `docs/reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md` are routed as follows:

- CI/test signal scope, strict-escapes drift, hotspots and masterplan CI-risk accuracy -> `CI-SIGNAL-RECONCILIATION-002`.
- Payments metadata-user/request-id findings -> completed by `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` / PR #996.
- Dead legacy payments services -> final cleanup if still unused after payments hardening.
- Admin auth wrapper consistency -> `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001`.
- Playback `getGatedMedia` footgun -> playback-domain evidence; revisit only if PR #994 did not resolve it.

## Historical or superseded runtime tickets

The following old cards are retained as background evidence but should not be used as direct prompts while the grouped queue exists: `COMMENTS-PRODUCTION-UX-API-CONTRACT-001`, `ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001`, `ADMIN-VIDEO-CLOUDFLARE-CONTAINMENT-001`, `ADMIN-VIDEO-TUS-UPLOAD-LIFECYCLE-001`, `X3-FIX-006`, `X3-FIX-008`, `ADMIN-VIDEO-PUBLICATION-AND-HERO-CONTRACT-001`, `LEGACY-ACCESS-POLICY-RETIREMENT-001`, `LEGACY-MEDIA-PROXY-RETIREMENT-001`, `ADMIN-AUTH-POSTMERGE-REVERIFY-001`, and `ADMIN-CHANNEL-ROOT-CAUSE-001`.

## Non-code evidence remains separate

Vercel, Cloudflare and Stripe production smoke/evidence tickets remain operator work and must not be mixed into code prompts unless a new code defect is identified.

## Continuing launch backlog

Legal/privacy/cookies/support copy remains `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`. Remaining non-code and evidence work includes Email consent boundary, Signed unsubscribe, Bounce/complaint suppression, System email events, Language persistence, Referral notifications, Runtime/provider privacy inventory, Legal copy PL/EN, Vercel production evidence, Stripe production evidence, Cloudflare production evidence, Backup, restore and alerts, X6.2, X6.3, X6.4, X6.5, X6.6, X6.7, X6.8, X6 certification, X7 Launch Evidence Pack, X7 certification, and Final owner launch decision. Public launch remains `NO_GO`.
