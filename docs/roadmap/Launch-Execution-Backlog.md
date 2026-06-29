# Launch Execution Backlog

Status: ACTIVE  
Purpose: non-executable launch backlog summary  
Current executable source: docs/tickets/ready/README.md  
Launch status: NO_GO  
Last reconciled: 2026-06-30 after PR #1259

This document is not an executable queue. Only `docs/tickets/ready/README.md` may identify the current executable work. This file summarizes launch-facing state and must not resurrect historical code prompts already marked complete in the ready queue.

## Grouped code queue after current-main review

| Order | Workstream | Ticket / state | Notes |
| ---: | --- | --- | --- |
| 1 | Video provider lifecycle | `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001 / DONE` | Historical grouped Cloudflare/admin media lifecycle work. Later multi-source/provider work continued through #1205, #1227 and #1248. |
| 2 | Video state contract | `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001 / DONE` | Completed publication, auto-publish, `publishedAt`, hero, sidebar and archive/unpublish transitions through the state-contract ticket. |
| 3 | Playback/access cleanup | `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001 / DONE` | Completed playback/access cleanup and legacy fallback retirement in PR #994. |
| 4 | Payments code hardening | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001 / DONE` | Code hardening implemented via PR #998; payment-to-PatronGrant operator smoke evidence remains separate. |
| 5 | CI/test/control-plane signal | `CI-SIGNAL-RECONCILIATION-002 / DONE` | Architecture audit follow-up: real test-suite signal, strict-escapes baseline drift, hotspots, masterplan risk accuracy. |
| 6 | Admin auth/channel diagnostics | `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001 / DONE` | Completed by PR #1008. No active large code ticket remains in the canonical ready queue. |
| 7 | AccessPolicy decommissioning | `LEGACY-ACCESS-POLICY-RETIREMENT-001 / DONE` | Completed by PR #1075: removed legacy `AccessPolicy` / `comment-access` runtime surface and added dual-layer guardrails. |
| 8 | Payments admin completion | `INCOMPLETE-003 + INCOMPLETE-005 / DONE` | PR #1250 completed admin dispute sync and admin refund endpoint/UI. Remaining payments-code item is only `INCOMPLETE-006` Stripe reconciliation job. |
| 9 | Legacy service cleanup | `CLEANUP-001 / PARTIAL` | PR #1224 moved `syncClerkAccess`; PR #1259 deleted `user-access.service.ts` and `audit.service.ts`. Remaining slices: `email.service.ts` and `lib/services/user/profile.service.ts`. |
| 10 | Thumbnail/media display hardening | `BUG-006 follow-up / DONE` | PR #1256 keeps thumbnail display behind `/api/videos/[id]/thumbnail`; raw private blob URL stays backend-only. |
| 11 | Current visual direction | `NAJS STYLE / MERGED` | PR #1257 applied the hand-drawn najs style to real homepage/channel surfaces after the experiment pass. |

## Architecture audit findings routed

Important findings from `docs/reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md` are routed as follows:

| Finding | Owner |
| --- | --- |
| CI/test signal scope gap | `CI-SIGNAL-RECONCILIATION-002` — DONE |
| strict-escapes baseline drift | `CI-SIGNAL-RECONCILIATION-002` — DONE |
| admin video page hotspot | `CI-SIGNAL-RECONCILIATION-002` — DONE |
| masterplan CI-risk accuracy | `CI-SIGNAL-RECONCILIATION-002` — DONE |
| payments metadata-user source-of-truth | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` — DONE by PR #998 |
| payments request-id idempotency | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` — DONE by PR #998 |
| payments refund/dispute admin surface | `INCOMPLETE-003` + `INCOMPLETE-005` — DONE by PR #1250 |
| Stripe reconciliation job | `INCOMPLETE-006` — TODO |
| dead legacy payments/services | `CLEANUP-001` — PARTIAL; only `email.service.ts` and `lib/services/user/profile.service.ts` remain in the active cleanup scope |
| admin auth wrapper consistency | `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` — DONE |
| playback `getGatedMedia` footgun | historical playback-domain evidence; revisit only if new current-main evidence shows a defect |
| deprecated AccessPolicy runtime surface | `LEGACY-ACCESS-POLICY-RETIREMENT-001` — DONE by PR #1075 |

## Resolved or superseded launch-roadmap items

These items were previously listed as remaining work but are no longer open launch-code prompts:

- Bounce/complaint suppression — DONE in current code path and tracked as completed in `docs/tickets/ready/README.md`.
- Referral notifications — SUPERSEDED because the referral system was removed; do not create new referral-notification work unless the owner reintroduces referrals.
- `syncClerkAccess` service migration — DONE by PR #1224.
- `user-access.service.ts` and `audit.service.ts` cleanup — DONE by PR #1259.
- Admin dispute sync — DONE by PR #1250.
- Admin refund endpoint/UI — DONE by PR #1250.
- Thumbnail private Blob display path hardening — DONE by PR #1256.

## Current open code remainder from old refactor/audit backlog

The old refactor/audit backlog has only two code remainders in the current ready queue:

1. `INCOMPLETE-006` — Stripe reconciliation job/cron.
2. `CLEANUP-001` — migrate `email.service.ts` and `lib/services/user/profile.service.ts` in separate small PRs.

Product issues such as #1204/#1228/#1218/#1219 may remain active product containers, but they are not the old large refactor prompt.

## Historical or superseded runtime tickets

The following old cards are retained as background evidence but should not be used as direct prompts while the grouped queue exists: `COMMENTS-PRODUCTION-UX-API-CONTRACT-001`, `ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001`, `ADMIN-VIDEO-CLOUDFLARE-CONTAINMENT-001`, `ADMIN-VIDEO-TUS-UPLOAD-LIFECYCLE-001`, `X3-FIX-006`, `X3-FIX-008`, `ADMIN-VIDEO-PUBLICATION-AND-HERO-CONTRACT-001`, `LEGACY-ACCESS-POLICY-RETIREMENT-001`, `LEGACY-MEDIA-PROXY-RETIREMENT-001`, `ADMIN-AUTH-POSTMERGE-REVERIFY-001`, and `ADMIN-CHANNEL-ROOT-CAUSE-001`.

## Non-code evidence remains separate

Vercel, Cloudflare and Stripe production smoke/evidence tickets remain operator work and must not be mixed into code prompts unless a new code defect is identified.

## Continuing launch backlog

Legal/privacy/cookies/support copy remains `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`. Remaining launch/evidence work includes Email consent boundary evidence, Signed unsubscribe evidence, System email events evidence, Language persistence evidence, Runtime/provider privacy inventory, Legal copy PL/EN, Vercel production evidence, Stripe production evidence, Cloudflare production evidence, Backup, restore and alerts, X6.2, X6.3, X6.4, X6.5, X6.6, X6.7, X6.8, X6 certification, X7 Launch Evidence Pack, X7 certification, and Final owner launch decision. Public launch remains `NO_GO`.
