# Architecture Repair Plan

Status: ACTIVE
Launch Status: NO_GO

This document defines the mandatory repair areas required to reach launch-ready state.

## Repair area V — Resend webhook idempotency, lock ownership and post-merge certification

### 1. Current Implementation State
- Status: MERGED_UNVERIFIED
- Baseline: PR #905
- Merge SHA: 36b57dec5c763ca29ff708c836dae0601125c49d
- Actual current HEAD: 36b57dec5c763ca29ff708c836dae0601125c49d
- Classification: Feature implemented partially; certification missing.

### 2. Confirmed Gaps
- No lock ownership (no attempt ID, no lease token).
- No fencing (stale worker can overwrite newer results).
- Stale worker overwrite risk.
- Type check performed after takeover (integrity risk).
- acquireLock called outside main error boundary.
- Raw internal error disclosure in public API responses.
- Production legacy shared-secret fallback active.
- Environment contract drift (missing required production vars).
- Integration tests skipped in CI.
- CI not running real PostgreSQL idempotency tests.
- Out-of-order counter ambiguity (sentCount semantics).
- Malformed payloads may be marked as processed.
- Wrong created_at path in ledger payload.
- Incomplete PII/retention boundary.
- Upgrade migration evidence missing for existing rows.

### 3. Required Target Lock Contract

```ts
type EmailEventLease = {
  providerEventId: string;
  eventType: string;
  leaseToken: string;
  attempt: number;
  acquiredAt: Date;
  leaseExpiresAt: Date;
};
```

**Required Semantics:**
- Each acquire/reacquire generates a new unique lease identity.
- Stale workers must be prohibited from finalizing after losing the lease.
- Release (success/failure) must be conditional.
- Finalization must use `updateMany` (Compare-And-Swap).
- `count === 0` during release must be handled as `LOST_OWNERSHIP`.
- `type` must be part of the integrity check during takeover.
- Event type mismatch must not lead to infinite retry loops.
- Stale threshold and heartbeat/lease policy must be explicit.
- Crash recovery must be testable via simulated process failure.

**Required Finalization Invariant:**
Worker may finalize `EmailEvent` **iff**:
1. `providerEventId` matches;
2. `eventType` matches;
3. `leaseToken/version` matches;
4. `status` is `PROCESSING`;
5. worker still owns the current attempt.

### 4. Required HTTP Contract
- Malformed provider request -> Deterministic 4xx.
- Invalid signature -> 401 Unauthorized.
- Active transient lock conflict -> Retryable 5xx (e.g., 503).
- Internal processing failure -> Generic 5xx body.
- Duplicate processed event -> Safe 2xx (idempotent success).
- Permanent integrity mismatch -> Alert + deterministic non-leaking response.
- **Strictly no raw internal exceptions in public responses.**

### 5. Required Security Contract
- Production environment MUST require Svix verification.
- Legacy shared-secret fallback is for non-production only (or requires owner-approved ADR exception).
- `RESEND_WEBHOOK_SECRET` must be part of production environment validation.
- Raw provider payloads, tokens, secrets, and unnecessary PII must not be logged.

### 6. Required Migration Contract
- Fresh migration path (empty database).
- Upgrade path for existing `EmailEvent` rows.
- Nullable `providerEventId` behavior for legacy rows.
- Unique index enforcement.
- Default status behavior rationale.
- Prevention of accidental reprocessing of legacy rows.
- Documented recovery/rollback procedure.
- Production migration remains operator-controlled evidence.

### 7. Definition of Completion
- Full repair ticket program executed.
- Real PostgreSQL 16 concurrency proof.
- Independent certification verdict: MERGE_CERTIFIED.
- Launch status remains NO_GO until final review.
