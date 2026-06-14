# Launch Execution Backlog

Status: ACTIVE
Purpose: complete non-executable launch backlog
Current executable source: docs/tickets/ready/README.md
Launch status: **NO_GO**

This document is not an executable queue. It lists planned items and stages. Only `docs/tickets/ready/README.md` identifies the single current executable ticket.

## Progress Summaries

### Execution Tickets by Status
- **IMPLEMENTED_VERIFIED / HISTORICAL**: 21
- **MERGED_UNVERIFIED**: 1
- **READY**: 1
- **BLOCKED / BACKLOG**: 42
- **DECISION_REQUIRED**: 1
- **Total Unique Ticket IDs**: 66

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
| 2.1 | Idempotency repair: Ownership | `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001` / **BLOCKED** | Verify-001 | Builder | None | Fencing/ownership proof | Launch blocker |
| 2.2 | Idempotency repair: Security | `EMAIL-WEBHOOK-ROUTE-SECURITY-001` / **BLOCKED** | Verify-001 | Builder | None | Svix-only production proof | Blocker |
| 2.3 | Idempotency repair: Errors | `EMAIL-WEBHOOK-ERROR-SAFETY-001` / **BLOCKED** | Verify-001 | Builder | None | Error redaction proof | High |
| 2.4 | Idempotency repair: Validation | `EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001` / **BLOCKED** | Verify-001 | Builder | None | Per-event schema proof | High |
| 2.5 | Idempotency repair: Migration | `EMAIL-WEBHOOK-MIGRATION-VERIFY-001` / **BLOCKED** | Verify-001 | Builder | None | Legacy upgrade proof | High |
| 2.6 | Idempotency repair: Counters | `EMAIL-WEBHOOK-COUNTER-SEMANTICS-001` / **DECISION_REQUIRED** | Verify-001 | Builder | Owner | Ordering logic proof | Medium |
| 2.7 | Idempotency repair: Privacy | `EMAIL-WEBHOOK-PRIVACY-RETENTION-001` / **BLOCKED** | Verify-001 | Builder | Owner | Retention/PII proof | Medium |
| 2.8 | Idempotency repair: Takeover | `EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001` / **BLOCKED** | Verify-001 | Builder | None | Integrity alert proof | High |
| 2.9 | CI Hardening | `ARCH-CI-001` / **OPEN** | None | Builder | None | Green CI with all checks | High |
| 2.10| Email Final Cert | `EMAIL-WEBHOOK-FINAL-CERT-001` / **BLOCKED** | Repairs | Certifier | None | Final report | Blocker |
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
