# Reconciliation Report: Resend Webhook Idempotency Post-Merge

Status: MERGED_UNVERIFIED / FIX_REQUIRED
Launch status: NO_GO
Baseline merge: PR #905
Merge SHA: 36b57dec5c763ca29ff708c836dae0601125c49d

## 1. Baseline Verification

- **Actual current HEAD:** 36b57dec5c763ca29ff708c836dae0601125c49d
- **Branch:** jules-11200317090075279347-629f43b8
- **Ancestry verification:** HEAD matches PR #905 merge commit.
- **Verification date:** 2026-06-14 (simulated)
- **Working tree:** Clean
- **PR #904/#905 relationship:** PR #905 replaced PR #904 as the corrective pass for email webhook idempotency.

## 2. Inventory of Changes

### Changed Production Files
- `lib/modules/email/infrastructure/email-event-lock.service.ts` (Core idempotency logic)
- `app/api/webhooks/resend/route.ts` (Webhook route entry point)
- `lib/modules/email/application/handle-resend-webhook.use-case.ts` (Orchestration)
- `lib/modules/email/domain/email.dto.ts` (DTO updates)
- `lib/modules/email/domain/email.errors.ts` (New error types)

### Changed Migration
- `prisma/migrations/20260614000000_add_email_event_idempotency/migration.sql`

### Changed Tests
- `tests/integration/email-event-idempotency.test.ts` (Integration tests, mostly skipped in CI)
- `tests/unit/modules/email/handle-resend-webhook.test.ts`
- `tests/unit/modules/email/idempotency-hardening.test.ts`

## 3. Execution Evidence

- **Tests that actually ran:** Unit tests for use-cases and DTOs.
- **Tests that were skipped:** `tests/integration/email-event-idempotency.test.ts` is skipped unless `RUN_INTEGRATION_TESTS=true`.
- **CI jobs and conclusions:** CI ran `integration-postgres` but skipped the real PostgreSQL concurrency tests for EmailEvent.
- **Vercel evidence:** Vercel deployment status is READY, but this does not verify idempotency correctness.

### Migration Evidence Table

| Evidence Area | Status | Notes |
| --- | --- | --- |
| Fresh PostgreSQL migrate deploy | VERIFIED | CI confirms migration applies to empty DB. |
| Upgrade with existing legacy rows | UNVERIFIED | No evidence of testing migration on non-empty DB. |
| Real lock concurrency | UNVERIFIED | Integration tests skipped; no evidence of real PG race testing. |
| Production migration | NOT_EXECUTED | |

## 4. Confirmed Gaps

### Code Gaps (CONFIRMED_GAP)
- **No Lock Ownership:** No attempt ID or lease token; stale workers can overwrite newer results.
- **No Fencing:** Stale worker may finalize after takeover.
- **Type Check Timing:** Takeover updateMany happens before type verification.
- **Error Boundary:** `acquireLock` is outside the main try/catch boundary.
- **Counter Ambiguity:** `sentCount` semantics are unclear for out-of-order events (e.g., DELIVERED before SENT).
- **Payload Validation:** Malformed payloads may be marked as PROCESSED without business effect.
- **Created_at path:** Wrong path used in minimal payload extraction.

### Security Gaps (CONFIRMED_SECURITY_GAP)
- **Legacy Fallback:** `x-resend-webhook-secret` fallback is active in production without Svix verification.
- **Error Disclosure:** Raw internal error messages/codes are returned in public responses.
- **Environment Drift:** `RESEND_WEBHOOK_SECRET` is not in `requiredProductionVars`.

### Privacy & Retention Gaps (PARTIAL / CONFIRMED_GAP)
- **PII Leakage:** `EmailEvent.email` still exists; raw errors may contain PII/tokens.
- **Retention:** No defined cleanup policy for the ledger.

## 5. Documentation Drift

- `docs/tickets/ready/README.md` still points to `PAYMENT-WEBHOOK-RESULT-001`.
- `docs/MASTERPLAN.md` lists `EMAIL-WEBHOOK-IDEMPOTENCY-001` as `IMPLEMENTATION_NOT_STARTED`.
- `docs/tickets/README.md` points to an unrelated ticket.

## 6. Ticket Mapping

- **Verification:** `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`
- **Ownership/Fencing:** `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001`
- **Integrity:** `EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001`
- **Security:** `EMAIL-WEBHOOK-ROUTE-SECURITY-001`
- **Safety:** `EMAIL-WEBHOOK-ERROR-SAFETY-001`
- **Counters:** `EMAIL-WEBHOOK-COUNTER-SEMANTICS-001`
- **Validation:** `EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001`
- **Migration:** `EMAIL-WEBHOOK-MIGRATION-VERIFY-001`
- **Privacy:** `EMAIL-WEBHOOK-PRIVACY-RETENTION-001`
- **CI Hardening:** `ARCH-CI-001`

## 7. Verdict

**PR #905 is merged but not independently certified.**
The implementation must not be treated as complete or launch-safe. Post-merge verification and follow-up repairs are mandatory.

### Evidence Status Table

| Evidence area | Status |
| --- | --- |
| Code merged | IMPLEMENTED_UNVERIFIED |
| Unit tests added | IMPLEMENTED_UNVERIFIED until rerun |
| Fresh PostgreSQL migrate deploy | VERIFIED |
| Upgrade with existing rows | UNVERIFIED |
| Real lock concurrency | UNVERIFIED |
| Stale takeover ownership | CONFIRMED_GAP |
| Full quality suite | NOT_EXECUTED / FAILED_GATE |
| Security audit | FAILED or UNRESOLVED |
| Production migration | NOT_EXECUTED |
| Production webhook behavior | NOT_EXECUTED |
