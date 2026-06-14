# EMAIL-WEBHOOK-PRIVACY-RETENTION-001 — Minimize EmailEvent ledger data and define retention

* **Status**: PARTIAL
* **Ticket ID**: EMAIL-WEBHOOK-PRIVACY-RETENTION-001
* **Role**: Builder
* **Launch impact**: MEDIUM_TO_HIGH

## Purpose
Minimize PII in the `EmailEvent` ledger and define a clear retention and cleanup policy for webhook payloads. Separate payload minimization from the retention duration decision.

## Verified current behavior
`EmailEvent` table still contains an `email` field and stores the full raw `payload` JSON, potentially containing PII indefinitely.

## Root cause
Absence of a defined data retention policy and lack of automated cleanup.

## Risk
- Compliance violation (GDPR) for storing PII longer than necessary.
- Unnecessary database growth from archiving raw provider payloads.

## Dependencies
- `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`
- **Owner decision required** (BLOCKER: `RETENTION_DECISION_REQUIRED`)

## Owner decisions required
- **Retention Duration**: How long should we keep processed payloads? (BLOCKER: `RETENTION_DECISION_REQUIRED`).
- **PII Minimization**: Can we delete the `email` column if `resendEmailId` is present?

## Allowed paths
- `lib/modules/email/infrastructure/email-event-lock.service.ts`
- `prisma/schema.prisma`
- `scripts/cleanup-email-events.ts` (new)

## Disallowed paths
- `lib/modules/payments/**`

## Target behavior
ledger contains the minimum data needed for idempotency and support. Payloads are purged automatically based on the owner-approved duration.

## Detailed acceptance criteria
1. Determine if `EmailEvent.email` is redundant.
2. Sanitize `payload` to remove PII if possible before storage.
3. Automated cleanup script or job created.
4. Retention policy documented in `EMAIL-COMMS-SPEC.md`.
5. Audit evidence for cleanup actions.

## Required unit tests
- Payload sanitization logic tests.

## Required integration tests
- Cleanup script successfully deletes expired rows.

## Required negative tests
- Cleanup script DOES NOT delete `PROCESSING` or recent `PROCESSED` rows.

## Migration impact
- Potential removal of `email` column.

## Security/privacy impact
Hardens GDPR compliance.

## Observability requirements
- Count of deleted rows in cleanup logs.

## Rollout/rollback requirements
- Standard deploy.

## Non-goals
- Fixing ownership.

## Required evidence
- Successful execution of cleanup script on test data.

## Exit state
`IMPLEMENTED_VERIFIED` after owner approved policy.
