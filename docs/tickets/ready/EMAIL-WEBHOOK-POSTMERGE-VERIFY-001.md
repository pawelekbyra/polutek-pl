# EMAIL-WEBHOOK-POSTMERGE-VERIFY-001 — Independently verify merged Resend webhook idempotency implementation

Status: **READY_FOR_CERTIFIER**
Ticket ID: EMAIL-WEBHOOK-POSTMERGE-VERIFY-001
Role: Reviewer / Certifier
Launch status: NO_GO

## Purpose

Independently verify the current state of the `main` branch following the merge of PR #905. This ticket focuses on verifying the implementation, identifying gaps, and documenting the results without performing runtime repairs.

## Verification Requirements

### 1. Environment Setup
- Node.js compliant with `.nvmrc`.
- PostgreSQL 16.
- Clean database for migration testing.
- Synthetic CI environment variables (NO REAL SECRETS):
  - `ADMIN_CLERK_USER_IDS=ci-admin`
  - `RESEND_WEBHOOK_SECRET=whsec_resend_ci`

### 2. Validation Suite
```bash
npm ci
npm run env:validate:prod
npx prisma validate
npx prisma generate
npm run quality:architecture-boundaries
npm run typecheck
npx vitest run tests/unit/api/resend/resend-webhook-route.test.ts
npx vitest run tests/unit/modules/email/handle-resend-webhook.test.ts
npx vitest run tests/unit/modules/email/idempotency-hardening.test.ts
npx vitest run tests/unit/modules/email/email-event-lock.repository.test.ts
npx vitest run tests/unit/modules/email/concurrency-retries.test.ts
npx vitest run tests/unit/modules/email/reproduce-idempotency-race.test.ts

# Run integration tests (Requires PG)
RUN_INTEGRATION_TESTS=true npx vitest run tests/integration/email-event-idempotency.test.ts

npm run test:coverage
npm run lint
npm run build
```

### 3. Migration Verification
- **Fresh DB**: `npx prisma migrate deploy` on an empty PG16 database.
- **Upgrade DB**:
  - Create schema PRIOR to 20260614000000.
  - Insert legacy `EmailEvent` rows.
  - Run `migrate deploy`.
  - Verify data integrity and index creation.

### 4. Concurrency Scenarios
- Parallel requests with same `providerEventId`.
- First worker still `PROCESSING`, second request result.
- `FAILED` event retry.
- Stale `PROCESSING` takeover.
- Old worker finalizing after takeover (ownership loss).
- Concurrent different event types for same `providerEventId`.

## Expected Result

The implementation in PR #905 is expected to fail certain concurrency and security invariants (specifically lock ownership and production signature bypass). This ticket MUST document these failures as evidence for follow-up repair tickets.

## Allowed Paths

- Read-only access to repository.
- `docs/reports/reconciliation/EMAIL-WEBHOOK-IDEMPOTENCY-VERIFICATION-001.md` (new report).
- Temporary uncommitted probes for verification.

## Non-goals

- Repairing runtime code.
- Merging failing tests into main.
- Changing schema or migrations.

## Exit State

- Verdict: `MERGE_CERTIFIED`, `FIX_REQUIRED`, or `BLOCKED`.
- Detailed verification report created.
- Repair tickets identified and promoted if necessary.
