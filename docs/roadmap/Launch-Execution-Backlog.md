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
| **Total Stages** | 24 |

*Note: A launch stage may consist of multiple execution tickets. These counts are not 1:1 with unique ticket IDs.*

## Backlog Table

| Order | Workstream | Planned ticket / state | Depends on | Executor | Action | Completion evidence | Launch impact |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Email consent boundary | `LAUNCH-EMAIL-003` / **COMPLETED** | None | Builder | None | PR #899 | Compliance blocker |
| 2 | System email events & idempotency | `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001` / **READY** | PR #905 merge | Reviewer | None | Independent certification report | Launch blocker |
| 2.1 | Idempotency repair: Ownership | `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001` / **BLOCKED** | Verify-001 | Builder | None | Fencing/ownership proof | Launch blocker |
| 2.2 | Idempotency repair: Security | `EMAIL-WEBHOOK-ROUTE-SECURITY-001` / **BLOCKED** | Verify-001 | Builder | None | Svix-only production proof | Blocker |
| 2.3 | Idempotency repair: Errors | `EMAIL-WEBHOOK-ERROR-SAFETY-001` / **BLOCKED** | Verify-001 | Builder | None | Error redaction proof | High |
| 3 | Signed unsubscribe | `LAUNCH-EMAIL-002` / **OPEN** | Stage 1 | Builder | None | Signed tokens, no plain emails | Compliance blocker |
| 4 | Bounce/suppression | **OPEN** | Stage 1 | Builder | Operator | Suppression working | Compliance blocker |
| 5 | Language persistence | **OPEN** | Stage 2 | Builder | None | PL/EN persistence | Localization |
| 6 | Architecture: Access Truth | `ARCH-ACCESS-001` / **OPEN** | Stage 2 | Builder | None | `AccessDecision` contract | Launch/Security |
| 7 | Architecture: Playback Gating | `ARCH-PLAYBACK-001` / **OPEN** | `ARCH-ACCESS-001` | Builder | None | Strict `PlaybackPlan` | Security |
| 8 | Architecture: Admin Auth | `ARCH-ADMIN-AUTH-001` / **OPEN** | Stage 2 | Builder | None | Canonical admin resolver | Security |
| 9 | Architecture: CI Guard | `ARCH-CI-001` / **OPEN** | Stage 2 | Builder | None | Mandatory CI guard | High |
| 10 | Legal copy PL/EN | `LAUNCH-LEGAL-001` / **OPEN** | Inventory | Agent | Legal | Terms/Privacy approved | Blocker |
| 11 | Vercel production evidence | **OPEN** | Prod access | Certifier | Operator | Redacted env/logs | X7 blocker |
| 12 | Stripe production evidence | **OPEN** | Stage 2 | Certifier | Operator | Tip -> Grant -> Refund proof | X7 blocker |
| 13 | Cloudflare production evidence| **OPEN** | Prod access | Certifier | Operator | Playback/denied proof | X7 blocker |
| 14 | Backup, restore and alerts | `DB-BACKUP-RESTORE` / **OPEN** | Prod access | Certifier | Operator | Restore drill success | X7 blocker |
| 15 | X6.2 State completeness | **OPEN** | Repairs | Certifier | None | X6.2 report | X6 blocker |
| 16 | X6.3 Responsive/browser | **OPEN** | Repairs | Certifier | Devices | X6.3 report | X6 blocker |
| 17 | X6.4 Accessibility | **OPEN** | Repairs | Certifier | None | X6.4 report | X6 blocker |
| 18 | X6.5 Performance | **OPEN** | Repairs | Certifier | Measure | X6.5 report | X6 blocker |
| 19 | X6.6 Copy/trust | **OPEN** | Stage 10 | Certifier | Legal | X6.6 report | X6 blocker |
| 20 | X6.7 Owner/admin usability | **OPEN** | Repairs | Certifier | Owner | X6.7 report | X6 blocker |
| 21 | X6.8 Representative user | **OPEN** | Stage 20 | Certifier | User | X6.8 report | X6 blocker |
| 22 | X6 certification | **OPEN** | X6.2-X6.8 | Certifier | Owner | X6 cert report | X7 prerequisite |
| 23 | X7 Launch Evidence Pack | **OPEN** | Stage 22 | Integrator | Operator | Complete Pack | Launch blocker |
| 24 | Final launch decision | **OPEN** | Stage 23 | Owner | Owner | Recorded decision | Go/No-Go |

## Architecture Repair Backlog (Ordered)

| Priority | ID | Title | Status | Dependency | Launch Impact |
| --- | --- | --- | --- | --- | --- |
| P0 | `ARCH-ACCESS-001` | Explicit AccessDecision contract | `TICKET_DETAIL_PENDING` | None | **BLOCKER** |
| P0 | `ARCH-PLAYBACK-001`| Strict PlaybackPlan union | `TICKET_DETAIL_PENDING` | `ARCH-ACCESS-001` | **BLOCKER** |
| P0 | `ARCH-ADMIN-AUTH-001`| Canonical admin authorization | `TICKET_DETAIL_PENDING` | None | **BLOCKER** |
| P0 | `ARCH-CI-001` | Architecture CI Guard | `OPEN` | None | **HIGH** |
| P1 | `ARCH-PATRON-001` | Audit successful grant creation | `TICKET_DETAIL_PENDING` | `ARCH-ACCESS-001` | **HIGH** |
| P2 | `ARCH-LEGACY-*` | Legacy service retirement | `OPEN` | None | **LOW** |

*Detailed architecture ticket files are created as needed for implementation.*
