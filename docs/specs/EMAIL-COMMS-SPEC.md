# EMAIL-COMMS-SPEC: System Emails and Broadcast Hardening

Status: ACTIVE
Launch status: **NO_GO**

## 1. Core Invariants

- **Subscription != Patron Access**: Unsubscribing from marketing never revokes a `PatronGrant`.
- **Consent Boundary**: System/transactional emails do NOT change marketing consent.
- **Privacy**: No plain-text emails in URLs; use signed tokens.

## 2. Resend Webhook Idempotency

### Authenticity
- **Production**: MUST use Svix HMAC-SHA256 verification (ID, Timestamp, Signature).
- **Non-Production**: May use legacy `x-resend-webhook-secret` (requires ADR/Owner approval).
- **Security**: No signature bypass in production routes.

### Provider Event Identity
- Every event is identified by `providerEventId` (Svix-id).
- IDs are unique and enforced via database constraints.

### Lease Ownership
- **Acquisition**: Every acquisition MUST create a unique `leaseToken`.
- **Attempt Tracking**: Incremental `attemptCount` for each re-acquisition.

### Fencing
- **Invariant**: A worker may finalize only when its `leaseToken` matches the current record.
- **Lost Ownership**: Finalization (`PROCESSED` or `FAILED`) MUST check `leaseToken` to prevent stale workers from overwriting results.
- **Concurrency**: Use conditional CAS/updateMany.

### Type Integrity
- **Takeover**: Takeover of stale/failed locks MUST strictly match the `eventType`.
- **Mismatch**: Deterministic conflict response on type mismatch for same ID.

### Idempotent Side Effects
- Business logic MUST be idempotent.
- Duplicate events must return safe 2xx without re-triggering logic.

### Event-Specific Validation
- Strict schema validation for each supported Resend event.
- Required `email_id` for delivery status updates.
- Required recipient email for `unsubscribe`.

### Retryability
- Malformed supported payloads -> Deterministic 4xx.
- Active lock conflicts -> Retryable 5xx.
- Internal errors -> Generic 5xx.

## 3. Error and Privacy Contract

### Response Error Safety
- Webhook routes MUST NOT return raw internal error messages.
- Deterministic safe error codes only.

### Persisted Error Safety
- `EmailEvent.error` MUST be redacted of secrets, tokens, SQL, and PII.

### Payload Minimization
- Sanitize raw provider payloads before storage.
- Minimize PII stored in the event ledger.

### Retention
**Status: RETENTION_DECISION_REQUIRED**.
Do not define a final duration until owner-approved.

### Counter Semantics
**Status: DECISION_REQUIRED**.
Final definition of `sentCount` and `errorCount` requires owner approval.

## 4. Required CI Enforcement
- `npm run quality:architecture-boundaries` is mandatory.
- `RUN_INTEGRATION_TESTS=true` for PG-backed idempotency tests.
- High `npm audit` failures must block merge.

## 5. Required Test Matrix

### Concurrency
- Parallel requests with identical `providerEventId`.
- Stale worker attempting finalization after takeover.
- Race between `SENT` and `DELIVERED` events.
- Crash between business logic and lock finalization.

### Data & Migration
- Upgrade path for legacy rows (nullable `providerEventId`).
- Data preservation during migration.

## 6. Forbidden Shortcuts

- **DO NOT** release by `providerEventId` alone without ownership proof.
- **DO NOT** takeover stale locks without strict type check.
- **DO NOT** allow legacy secret fallback in production without ADR.
- **DO NOT** return or persist raw internal error messages.
- **DO NOT** mark malformed supported events as `PROCESSED`.
- **DO NOT** treat skipped or not-run integration tests as PASS.
- **DO NOT** use Vercel READY as certification of idempotency logic.

## 7. Post-Merge Certification

Implementation is only considered certified after an independent review of:
1. Lock ownership/fencing correctness.
2. Production security enforcement (Svix).
3. Accurate counter semantics (post-decision).
4. Privacy/PII redaction and retention (post-decision).
