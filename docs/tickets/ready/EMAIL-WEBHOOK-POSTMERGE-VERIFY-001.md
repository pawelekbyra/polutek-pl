# EMAIL-WEBHOOK-POSTMERGE-VERIFY-001 — Independently verify merged Resend webhook idempotency implementation

* **Status**: READY_FOR_CERTIFIER
* **Ticket ID**: EMAIL-WEBHOOK-POSTMERGE-VERIFY-001
* **Role**: Reviewer / Certifier
* **Launch status**: NO_GO

## Purpose
Independently verify the current state of the `main` branch following the merge of PR #905. This ticket focuses on documenting baseline behavior, identified gaps, and providing evidence for follow-up repairs.

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
npm run quality:strict-escapes
npm run quality:hotspots
npm run typecheck

npx vitest run tests/unit/api/resend/resend-webhook-route.test.ts
npx vitest run tests/unit/modules/email/handle-resend-webhook.test.ts
npx vitest run tests/unit/modules/email/idempotency-hardening.test.ts
npx vitest run tests/unit/modules/email/email-event-lock.repository.test.ts
npx vitest run tests/unit/modules/email/concurrency-retries.test.ts
npx vitest run tests/unit/modules/email/reproduce-idempotency-race.test.ts

# Run integration tests (Requires PG)
RUN_INTEGRATION_TESTS=true \
npx vitest run tests/integration/email-event-idempotency.test.ts

npm run test:coverage
npm run lint
npm run build
npm audit --audit-level=high
```

### 3. Complete Upgrade Migration Evidence
- Use schema BEFORE migration `20260614000000`.
- Insert realistic legacy `EmailEvent` rows:
  - Different `type` values.
  - Valid `resendEmailId`.
  - Valid `email`.
  - Valid `payload`.
  - `providerEventId` MUST be NULL.
- Run `npx prisma migrate deploy`.
- Verify:
  - Old data is preserved.
  - Default status is correctly set.
  - Unique index allows NULLs or handled per database spec.
  - No accidental re-processing of legacy rows.

### 4. Complete Concurrency / Negative Matrix
- **Duplicate ID**: Identical `providerEventId` concurrent requests.
- **Active PROCESSING**: Attempt to acquire while status is `PROCESSING`.
- **FAILED Retry**: Re-acquire after `FAILED`.
- **Stale Takeover**: Re-acquire after 10m in `PROCESSING`.
- **Ownership Loss (Success)**: Old worker attempts `releaseWithSuccess` after takeover.
- **Ownership Loss (Failure)**: Old worker attempts `releaseWithFailure` after takeover.
- **Type Mismatch**: Re-acquire with same ID but different `type`.
- **Recipient Isolation**: Two different `providerEventId` for one user.
- **Order Race (SENT vs DELIVERED)**: Verify aggregate counters.
- **Order Race (DELIVERED vs BOUNCED)**: Verify aggregate counters.
- **Crash Recovery**: Mutation committed, but lock finalization failed.
- **Acquire Error**: Non-P2002 error during `acquireLock`.
- **Release Error**: Exception during finalization calls.
- **Error Redaction**: Verify PII/Secrets removed from `EmailEvent.error`.
- **Production Safety**: Reject legacy fallback when `svix` headers missing in PROD.

## Expected Verdict
**Do not force PASS.** The implementation in PR #905 is expected to fail ownership, fencing, and production security invariants. The expected verdict is `FIX_REQUIRED`.

## Allowed Paths
- Read-only access to repository.
- `docs/reports/reconciliation/EMAIL-WEBHOOK-IDEMPOTENCY-VERIFICATION-001.md`.
- Temporary uncommitted probes.

## Exit State
- Detailed verification report created.
- Verdict: `FIX_REQUIRED`.
- All gaps mapped to repair tickets.
