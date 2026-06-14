# EMAIL-WEBHOOK-MIGRATION-VERIFY-001 — Verify EmailEvent idempotency migration on fresh and upgraded PostgreSQL

* **Status**: EVIDENCE_MISSING
* **Ticket ID**: EMAIL-WEBHOOK-MIGRATION-VERIFY-001
* **Role**: Builder
* **Launch impact**: HIGH

## Purpose
Verify that the `20260614000000_add_email_event_idempotency` migration works correctly on both fresh and upgraded databases without data loss or accidental re-processing of legacy events.

## Verified current behavior
Migration file exists, but its behavior on a database with existing rows (legacy events without `providerEventId`) is unverified.

## Root cause
PR #905 was merged without independent verification of the upgrade path.

## Risk
- Migration failure on production due to unique index constraints on nullable columns.
- Accidental re-processing of thousands of legacy events if default status is not handled.

## Dependencies
- `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`

## Owner decisions required
- Confirmation of default status for legacy rows (Target: `PROCESSED`).

## Allowed paths
- `prisma/migrations/**` (if repair needed)
- `tests/integration/migration-rehearsal.test.ts` (new)

## Disallowed paths
- `lib/**`
- `app/**`

## Target behavior
Verified migration path that preserves data and enforces constraints safely.

## Detailed acceptance criteria
1. Fresh DB deploy success on PostgreSQL 16.
2. Upgrade from pre-migration schema with existing `EmailEvent` rows.
3. Realistic legacy rows (different types, resendEmailId present, providerEventId NULL).
4. `providerEventId` remains NULL for legacy rows.
5. Unique index exists and allows multiple NULL values (if PG) or handled correctly.
6. Legacy events are NOT accidentally re-processed by new logic.
7. Documented rollback and recovery steps.

## Required unit tests
- None.

## Required integration tests
- **Migration Rehearsal**:
  - Deploy old schema.
  - Insert legacy data.
  - Run `prisma migrate deploy`.
  - Verify row occupancy and status.

## Required negative tests
- Attempt to insert duplicate `providerEventId` after migration.

## Migration impact
High. Affects production database schema.

## Security/privacy impact
Prevents data loss during rollout.

## Observability requirements
- Migration logs.

## Rollout/rollback requirements
- **Rollout**: `npx prisma migrate deploy`.
- **Rollback**: Manual SQL script to drop columns/index if needed.

## Non-goals
- Fixing ownership logic.

## Required evidence
- Integration test results for the "Upgrade" scenario.

## Exit state
`IMPLEMENTED_VERIFIED`.
