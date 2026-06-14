# Launch Execution Backlog

Status: ACTIVE
Purpose: complete non-executable launch backlog
Current executable source: docs/tickets/ready/README.md
Launch status: **NO_GO**

This document is not an executable queue. It lists planned items and stages. Only `docs/tickets/ready/README.md` identifies the single current executable ticket.

## Launch Stage Summary

| Status | Count |
| --- | --- |
| **COMPLETED** | 5 |
| **PARTIAL / IN_PROGRESS** | 2 |
| **OPEN / NOT_STARTED** | 17 |
| **BLOCKED** | 0 |
| **Total Launch Stages** | 24 |

*Note: A launch stage may consist of multiple execution tickets. These counts are not 1:1 with unique ticket IDs.*

## Backlog Table

| Order | Workstream | Planned ticket / state | Depends on | Executor | Action | Completion evidence | Launch impact |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Email consent boundary | `LAUNCH-EMAIL-003` / **COMPLETED** | None | Builder | None | PR #899 | Compliance blocker |
| 2 | System email events & idempotency | `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001` / **READY** | PR #905 merge | Reviewer | None | Independent certification report | Launch blocker |
| 2.1 | Idempotency repair: Ownership | `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001` / **BLOCKED** | Verify-001 | Builder | None | Fencing/ownership proof | Launch blocker |
| 2.2 | Idempotency repair: Security | `EMAIL-WEBHOOK-ROUTE-SECURITY-001` / **BLOCKED** | Verify-001 | Builder | None | Svix-only production proof | Blocker |
| 2.3 | Idempotency repair: Errors | `EMAIL-WEBHOOK-ERROR-SAFETY-001` / **BLOCKED** | Verify-001 | Builder | None | Error redaction proof | High |
| 2.4 | Idempotency repair: Validation | `EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001` / **BLOCKED** | Verify-001 | Builder | None | Per-event schema proof | High |
| 2.5 | Idempotency repair: Migration | `EMAIL-WEBHOOK-MIGRATION-VERIFY-001` / **BLOCKED** | Verify-001 | Builder | None | Legacy upgrade proof | High |
| 2.6 | Idempotency repair: Counters | `EMAIL-WEBHOOK-COUNTER-SEMANTICS-001` / **BLOCKED** | Verify-001 | Builder | None | Ordering logic proof | Medium |
| 2.7 | Idempotency repair: Privacy | `EMAIL-WEBHOOK-PRIVACY-RETENTION-001` / **BLOCKED** | Verify-001 | Builder | None | Retention/PII proof | Medium |
| 3 | Signed unsubscribe | `LAUNCH-EMAIL-002` / **OPEN** | Stage 1 | Builder | None | Signed tokens, no plain emails | Compliance blocker |
| 4 | Bounce/suppression | **OPEN** | Stage 1 | Builder | Operator | Suppression working | Compliance blocker |
| 5 | Language persistence | **OPEN** | Stage 2 | Builder | None | PL/EN persistence | Localization |
| 10 | Legal copy PL/EN | `LAUNCH-LEGAL-001` / **OPEN** | Inventory | Agent | Legal | Terms/Privacy approved | Blocker |
| 11 | Vercel production evidence | **OPEN** | Prod access | Certifier | Operator | Redacted env/logs | X7 blocker |
| 12 | Stripe production evidence | **OPEN** | Stage 2 | Certifier | Operator | Tip -> Grant -> Refund proof | X7 blocker |
| 13 | Cloudflare production evidence| **OPEN** | Prod access | Certifier | Operator | Playback/denied proof | X7 blocker |
| 14 | Backup, restore and alerts | `DB-BACKUP-RESTORE` / **OPEN** | Prod access | Certifier | Operator | Restore drill success | X7 blocker |
| 22 | X6 certification | **OPEN** | X6.2-X6.8 | Certifier | Owner | X6 cert report | X7 prerequisite |
| 23 | X7 Launch Evidence Pack | **OPEN** | Stage 22 | Integrator | Operator | Complete Pack | Launch blocker |
| 24 | Final launch decision | **OPEN** | Stage 23 | Owner | Owner | Recorded decision | Go/No-Go |

## Architecture Repair Backlog (Ordered)

| Priority | ID | Title | Status | Dependency | Launch Impact | Promotion Condition |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | `ARCH-ADMIN-AUTH-001` | Canonical admin authorization | `TICKET_DETAIL_PENDING` | None | **BLOCKER** | Functional resolver + regression tests |
| P0 | `ARCH-ACCESS-001` | Explicit AccessDecision contract | `TICKET_DETAIL_PENDING` | None | **BLOCKER** | Unified auth contract + drift sync |
| P0 | `ARCH-PLAYBACK-001`| Strict PlaybackPlan union | `TICKET_DETAIL_PENDING` | `ARCH-ACCESS-001` | **BLOCKER** | READY iff playable |
| P0 | `ARCH-PLAYBACK-002`| Remove READY + canPlay inconsistency | `TICKET_DETAIL_PENDING` | `ARCH-PLAYBACK-001` | **HIGH** | No player mount on deny |
| P0 | `ARCH-CACHE-001` | Sensitive response non-cacheable | `TICKET_DETAIL_PENDING` | None | **HIGH** | private/no-store headers |
| P0 | `ARCH-PATRON-001` | Audit successful grant creation | `TICKET_DETAIL_PENDING` | `ARCH-ACCESS-001` | **HIGH** | Every transition audited |
| P0 | `ARCH-CLERK-001` | Durable Clerk repair/reconciliation | `TICKET_DETAIL_PENDING` | None | **HIGH** | Outbox/Retry for Clerk |
| P0 | `ARCH-PAYMENT-001` | Explicit fulfillment eligibility | `TICKET_DETAIL_PENDING` | `ARCH-PATRON-001` | **HIGH** | Policy-based grants |
| P0 | `ARCH-CI-001` | Architecture and Critical CI Guard | `OPEN` | None | **HIGH** | Boundaries + RUN_INTEGRATION_TESTS |
| P0 | `ARCH-LOG-001` | Log sanitization (Secrets/PII) | `TICKET_DETAIL_PENDING` | None | **HIGH** | Redaction helpers in all flows |
| P0 | `ARCH-COMMENTS-001`| Canonical comments permission | `TICKET_DETAIL_PENDING` | `ARCH-ACCESS-001` | **MEDIUM** | Read/Write matrix + Access integration |
| P1 | `ARCH-DI-*` | Dependency Injection / Boundaries | `OPEN` | None | **MEDIUM** | Remove direct Prisma in app layer |
| P1 | `ARCH-ADMIN-*` | Access Diagnostics / Admin Override | `OPEN` | None | **MEDIUM** | Complete admin support tools |
| P2 | `ARCH-LEGACY-*` | Legacy service retirement (1-7) | `OPEN` | None | **LOW** | No imports from lib/services |
| P2 | `ARCH-DOCS-001` | Final architecture reconciliation | `OPEN` | All repairs | **LOW** | No drift in control plane |
