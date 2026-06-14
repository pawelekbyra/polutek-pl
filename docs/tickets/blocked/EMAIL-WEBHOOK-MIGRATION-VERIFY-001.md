# EMAIL-WEBHOOK-MIGRATION-VERIFY-001 — Verify EmailEvent idempotency migration

Status: **EVIDENCE_MISSING**
Ticket ID: EMAIL-WEBHOOK-MIGRATION-VERIFY-001
Launch impact: **HIGH**

## Purpose
Verify that the `20260614000000_add_email_event_idempotency` migration works correctly on both fresh and upgraded databases without data loss or accidental re-processing of legacy events.

## Target Behavior
- Fresh DB deploy success.
- Upgrade from pre-migration schema with existing `EmailEvent` rows.
- Verify `providerEventId` remains nullable for legacy rows.
- Verify unique index and default statuses.

## Acceptance Criteria
- Proven migration path with legacy data.
- No re-processing of already handled events.
- Documented recovery steps.
