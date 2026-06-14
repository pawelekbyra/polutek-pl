# EMAIL-COMMS-SPEC: System Emails and Broadcast Hardening

Status: ACTIVE
Launch status: **NO_GO**

## 1. Core Invariants

- **Subscription != Patron Access**: Unsubscribing from marketing never revokes a `PatronGrant`.
- **Consent Boundary**: System/transactional emails do NOT change marketing consent.
- **Privacy**: No plain-text emails in URLs; use signed tokens.

## 2. Resend Webhook Idempotency

### Webhook Authenticity
- **Production**: MUST use Svix HMAC-SHA256 verification.
- **Non-Production**: May use legacy `x-resend-webhook-secret` (requires ADR/Owner approval).

### Identity and Lease Ownership
- Every event is identified by `providerEventId` (Svix-id).
- **Lease Ownership**: Every acquisition MUST create a unique `leaseToken`.
- **Fencing**: Finalization (`PROCESSED` or `FAILED`) MUST check `leaseToken` to prevent stale workers from overwriting results.
- **Type Integrity**: Takeover of stale/failed locks MUST strictly match the `eventType`.

### side effects
- Business logic MUST be idempotent.
- **Counter Semantics**: `sentCount` increments must handle out-of-order delivery. `DELIVERED` before `SENT` should still count as 1 send.

### Validation
- Strict per-event schema validation.
- Return 400 for malformed supported events.

## 3. Error and Privacy Contract

- **Response Safety**: Webhook routes MUST return generic 500/400 messages without internal details.
- **Redaction**: `EmailEvent.error` and logs MUST be redacted of secrets, tokens, and PII.
- **Retention**: Webhook payloads are retained for 30 days.

## 4. Required Evidence

- **Real PostgreSQL Concurrency**: Integration tests proving fencing under race conditions.
- **Migration Proof**: Proven upgrade path for legacy rows.
- **Security Proof**: Production signature verification enforcement.

## 5. Post-Merge Certification

Implementation is only considered certified after an independent review of:
1. Lock ownership/fencing correctness.
2. Production security enforcement.
3. Accurate counter semantics.
4. Privacy/PII redaction.
