# Launch Execution Backlog

Status: ACTIVE — GROUPED ROADMAP RECONCILED 2026-06-20
Purpose: non-executable launch backlog summary
Current executable source: docs/tickets/ready/README.md
Launch status: NO_GO

This document is not an executable queue. Only `docs/tickets/ready/README.md` may identify the current executable ticket.

## Grouped code queue after video lifecycle refactor

| Order | Workstream | Ticket / state | Notes |
| ---: | --- | --- | --- |
| 0 | Video provider lifecycle | `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001 / DONE` | Completed by the grouped Cloudflare admin media lifecycle work: direct upload, manual attach, legacy import, sync/webhook reconciliation, publish-after-ready details and truthful admin media states. |
| 1 | Video state contract | `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001 / CURRENT` | Publication, auto-publish, `publishedAt`, hero, sidebar and archive/unpublish transitions. |
| 2 | Playback/access cleanup | `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001 / PLANNED_AFTER_VIDEO_STATE_CONTRACT` | Reconcile legacy playback/access paths into one consistent playback contract. |
| 3 | Payments code hardening | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001 / PLANNED_AFTER_PLAYBACK_ACCESS_RETIREMENT` | Code hardening before payment-to-PatronGrant operator smoke evidence. |
| 4 | Admin auth/channel diagnostics | `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001 / PLANNED_AFTER_PAYMENTS_HARDENING` | Regression coverage and production-safe admin diagnostics. |

## Historical or superseded runtime tickets

The following old cards are retained as background evidence but should not be used as direct prompts while the grouped queue exists: `COMMENTS-PRODUCTION-UX-API-CONTRACT-001`, `ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001`, `ADMIN-VIDEO-CLOUDFLARE-CONTAINMENT-001`, `ADMIN-VIDEO-TUS-UPLOAD-LIFECYCLE-001`, `X3-FIX-006`, `X3-FIX-008`, `ADMIN-VIDEO-PUBLICATION-AND-HERO-CONTRACT-001`, `LEGACY-ACCESS-POLICY-RETIREMENT-001`, `LEGACY-MEDIA-PROXY-RETIREMENT-001`, `ADMIN-AUTH-POSTMERGE-REVERIFY-001`, and `ADMIN-CHANNEL-ROOT-CAUSE-001`.

Use the grouped queue instead:

- provider lifecycle work was completed through `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001`;
- publication/hero/sidebar work now belongs to `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001`;
- playback legacy retirement belongs to `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001`;
- payments idempotency belongs to `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001`;
- admin auth/channel diagnostics belongs to `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001`.

## Non-code evidence remains separate

Vercel, Cloudflare and Stripe production smoke/evidence tickets remain operator work and must not be mixed into code prompts unless a new code defect is identified.

## Continuing launch backlog

Legal/privacy/cookies/support copy remains `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`. Production evidence, backup/restore drills, X6 evidence, X7 certification and final owner launch decision remain open. Public launch remains `NO_GO`.
