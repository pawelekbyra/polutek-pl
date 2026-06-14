# Launch Execution Backlog

Status: ACTIVE
Purpose: complete non-executable launch backlog
Current executable source: docs/tickets/ready/README.md
Launch status: NO_GO

This document is not an executable queue.
It may list many planned items.
Only docs/tickets/ready/README.md may identify the single current executable ticket.

## Backlog table

| Order | Workstream | Planned ticket / state | Depends on | Primary executor | Owner/operator/legal action | Completion evidence | Launch impact |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Email Webhook Verification | EMAIL-WEBHOOK-POSTMERGE-VERIFY-001 | PR #905 merged | Certifier | None | Reconciliation report with real PG concurrency proof | **BLOCKER** |
| 2 | Email Webhook Repair | EMAIL-WEBHOOK-LOCK-OWNERSHIP-001 | POSTMERGE-VERIFY | Builder | None | Lease ownership and fencing implemented | **BLOCKER** |
| 3 | Email Webhook Repair | EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001 | LOCK-OWNERSHIP | Builder | None | Type check during takeover enforced | **HIGH** |
| 4 | Email Webhook Repair | EMAIL-WEBHOOK-ROUTE-SECURITY-001 | POSTMERGE-VERIFY | Builder | None | Svix mandatory in production, no fallback | **BLOCKER** |
| 5 | Email Webhook Repair | EMAIL-WEBHOOK-ERROR-SAFETY-001 | POSTMERGE-VERIFY | Builder | None | No raw error disclosure in public API | **HIGH** |
| 6 | Email Webhook Repair | EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001 | POSTMERGE-VERIFY | Builder | None | Event-specific validation implemented | **HIGH** |
| 7 | Email Webhook Repair | EMAIL-WEBHOOK-MIGRATION-VERIFY-001 | POSTMERGE-VERIFY | Operator/Certifier | Upgrade drill | Migration evidence on non-empty DB | **HIGH** |
| 8 | Email Webhook Repair | EMAIL-WEBHOOK-COUNTER-SEMANTICS-001 | POSTMERGE-VERIFY | Builder/Owner | Semantic decision | No undercounts in out-of-order events | **MEDIUM** |
| 9 | Email Webhook Repair | EMAIL-WEBHOOK-PRIVACY-RETENTION-001 | POSTMERGE-VERIFY | Builder | Retention decision | Minimal ledger data and cleanup job | **MEDIUM** |
| 10 | CI Hardening | ARCH-CI-001 | POSTMERGE-VERIFY | Builder/Integrator | None | Mandatory architecture and PG tests in CI | **HIGH** |
| 11 | Email Webhook Final Cert | EMAIL-WEBHOOK-FINAL-CERT-001 | ALL REPAIRS | Certifier | Owner approval | Certification report | **BLOCKER** |
| 12 | Signed unsubscribe | Planned, not ticketed | Email consent boundary | Builder | None | Signed token, works without login | **BLOCKER** |
| 13 | Bounce/complaint suppression | Planned, not ticketed | Email consent boundary | Builder + operator | Provider access/evidence | Provider events, suppression | **BLOCKER** |
| 14 | System email events | Planned, not ticketed | Email consent boundary | Builder | None | First tip + patron granted as one mail | **BLOCKER** |
| 15 | Language persistence | Planned, not ticketed | System email event audit | Builder | None | DB persistence, first email language | **BLOCKER** |
| 16 | Legal copy PL/EN | Planned, not ticketed | Runtime/provider privacy inventory | Lawyer | Professional review | Terms, privacy, cookies | **BLOCKER** |
| 17 | Vercel production evidence | Operator pending | Production access | Operator | Operator access | Redacted environment evidence | **BLOCKER** |
| 18 | Stripe production evidence | Operator pending | Production access | Operator | Controlled test | PatronGrant fulfillment evidence | **BLOCKER** |
| 19 | Backup, restore and alerts | Operator pending | Production access | Operator | Restore drill | Restore drill result, alert delivery | **BLOCKER** |
| 20 | X7 certification | Planned, not ticketed | Legal, runtime, operator and X6 completion | Certifier | Owner review | Complete Launch Evidence Pack | **BLOCKER** |
