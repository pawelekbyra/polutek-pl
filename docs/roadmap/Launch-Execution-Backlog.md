# Launch Execution Backlog

Status: ACTIVE
Purpose: complete non-executable launch backlog
Current executable source: docs/tickets/ready/README.md
Launch status: **NO_GO**

This document is not an executable queue. It lists planned items and stages. Only `docs/tickets/ready/README.md` identifies the single current executable ticket.

## Progress Summaries

### Execution Tickets by Status
- **IMPLEMENTED_VERIFIED / HISTORICAL**: 62
- **MERGED_UNVERIFIED**: 1
- **READY**: 1
- **BLOCKED**: 13
- **DECISION_REQUIRED**: 1
- **PLANNED / TICKET_DETAIL_PENDING**: 31
- **Total Unique Ticket IDs**: 109

### Launch Stages by Status
- **COMPLETED**: 5
- **PARTIAL / IN_PROGRESS**: 2
- **OPEN / NOT_STARTED**: 17
- **BLOCKED**: 0
- **Total Launch Stages**: 24

## Backlog Table (Stages 1-24)

| Order | Workstream | Planned ticket / state | Depends on | Executor | Action | Completion evidence | Launch impact |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Email consent boundary | `LAUNCH-EMAIL-003` / **COMPLETED** | None | Builder | None | PR #899 | Compliance blocker |
| 2 | System email events & idempotency | `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001` / **READY** | PR #905 merge | Reviewer | None | Independent certification report | Launch blocker |
| 3 | Signed unsubscribe | `LAUNCH-EMAIL-002` / **OPEN** | Stage 1 | Builder | None | Signed tokens, no plain emails | Compliance blocker |
| 4 | Bounce/suppression | **OPEN** | Stage 1 | Builder | Operator | Suppression working | Compliance blocker |
| 5 | Language persistence | **OPEN** | Stage 2 | Builder | None | PL/EN persistence | Localization |
| 6 | Referral notifications | **OPEN** | Stage 5 | Builder | Owner | Counter independent from toggle | Non-core |
| 7 | Privacy inventory | **OPEN** | Stage 5 | Agent | Owner | Data fields and cookies verified | Legal |
| 8 | Legal copy drafting | **OPEN** | Stage 7 | Agent | Legal | Draft terms and privacy | Legal |
| 9 | Legal professional review | **OPEN** | Stage 8 | Legal | Legal | Final approved legal text | Blocker |
| 10 | Legal copy publication | `LAUNCH-LEGAL-001` / **OPEN** | Stage 9 | Builder | None | Terms/Privacy published | Blocker |
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

## Email Repair Program (Supporting Stage 2)

| Order | ID | Title | Status | Dependency | Launch Impact |
| --- | --- | --- | --- | --- | --- |
| 2.1 | `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001` | Add lease ownership | **BLOCKED** | Verify-001 | **BLOCKER** |
| 2.2 | `EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001` | Event type integrity | **BLOCKED** | Ownership-001 | **HIGH** |
| 2.3 | `EMAIL-WEBHOOK-ROUTE-SECURITY-001` | Svix Prod Enforcement | **BLOCKED** | Verify-001 | **BLOCKER** |
| 2.4 | `EMAIL-WEBHOOK-ERROR-SAFETY-001` | Prevent disclosure | **BLOCKED** | Verify-001 | **HIGH** |
| 2.5 | `EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001` | Per-event schema | **BLOCKED** | Verify-001 | **HIGH** |
| 2.6 | `EMAIL-WEBHOOK-MIGRATION-VERIFY-001` | Verify legacy upgrade | **BLOCKED** | Verify-001 | **HIGH** |
| 2.7 | `EMAIL-WEBHOOK-COUNTER-SEMANTICS-001` | Define aggregate counters | **DECISION_REQUIRED**| Verify-001 | **MEDIUM** |
| 2.8 | `EMAIL-WEBHOOK-PRIVACY-RETENTION-001` | Minimize PII | **BLOCKED** | Verify-001 | **MEDIUM** |
| 2.9 | `ARCH-CI-001` | Architecture CI Guard | **OPEN** | None | **HIGH** |
| 2.10| `EMAIL-WEBHOOK-FINAL-CERT-001` | Final email certification | **BLOCKED** | Repairs | **BLOCKER** |

## Architecture Repair Backlog (P0 - Launch Correctness)

| ID | Title | Priority | Status | Dependency | Launch Impact |
| --- | --- | ---: | --- | --- | --- |
| `ARCH-ADMIN-AUTH-001` | Canonical admin authorization | P0 | `TICKET_DETAIL_PENDING` | None | **BLOCKER** |
| `ARCH-ACCESS-001` | Explicit AccessDecision contract | P0 | `TICKET_DETAIL_PENDING` | None | **BLOCKER** |
| `ARCH-PLAYBACK-001` | Strict PlaybackPlan union | P0 | `TICKET_DETAIL_PENDING` | `ARCH-ACCESS-001` | **BLOCKER** |
| `ARCH-PLAYBACK-002` | Remove READY + canPlay inconsistency | P0 | `TICKET_DETAIL_PENDING` | `ARCH-PLAYBACK-001` | **HIGH** |
| `ARCH-CACHE-001` | Sensitive response non-cacheable | P0 | `TICKET_DETAIL_PENDING` | None | **HIGH** |
| `ARCH-PATRON-001` | Audit successful grant creation | P0 | `TICKET_DETAIL_PENDING` | `ARCH-ACCESS-001` | **HIGH** |
| `ARCH-PATRON-002` | Suspend/reactivate lifecycle | P0 | `TICKET_DETAIL_PENDING` | `ARCH-PATRON-001` | **HIGH** |
| `ARCH-PATRON-003` | Refund revokes only linked grant | P0 | `TICKET_DETAIL_PENDING` | `ARCH-PATRON-001` | **HIGH** |
| `ARCH-CLERK-001` | Durable Clerk sync repair | P0 | `TICKET_DETAIL_PENDING` | None | **HIGH** |
| `ARCH-PAYMENT-001` | Explicit fulfillment eligibility | P0 | `TICKET_DETAIL_PENDING` | `ARCH-PATRON-001` | **HIGH** |
| `ARCH-LOG-001` | Log sanitization (Secrets/PII) | P0 | `TICKET_DETAIL_PENDING` | None | **HIGH** |
| `ARCH-E2E-001` | Denied playback regression tests | P0 | `TICKET_DETAIL_PENDING` | `ARCH-PLAYBACK-002` | **HIGH** |
| `ARCH-COMMENTS-001` | Canonical comments permission | P0 | `TICKET_DETAIL_PENDING` | `ARCH-ACCESS-001` | **MEDIUM** |
