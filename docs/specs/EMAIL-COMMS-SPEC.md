# Email / Newsletter / Broadcast Spec

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE. Ta specyfikacja jest target/product standard w aktywnym control plane, ale nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: Email / Newsletter / Broadcast.

## Product rules

- Subscription = mailing consent only.
- Patron != newsletter subscriber.
- Unsubscribe never affects PatronGrant.
- Patron does not imply marketing consent.
- Transactional emails separate from marketing.
- PL/EN templates.
- Admin broadcast audit.

## Technical Invariants

### 1. Resend Webhook Authenticity
- Production environment requires Svix signature verification (ID, Timestamp, Signature).
- Legacy shared-secret fallback is prohibited in production without an explicit ADR.
- `RESEND_WEBHOOK_SECRET` must be validated as a required production variable.

### 2. Event Identity and Idempotency
- `providerEventId` (mapped from `svix-id`) is the mandatory unique identifier for all events.
- Atomic idempotency is managed via `EmailEventLockService`.
- Minimal payload retention: only essential identifiers are stored in the ledger.

### 3. Lease Ownership and Fencing
- Every lock acquisition/takeover must generate a unique `leaseToken`.
- Success/Failure release is conditional on holding the current valid lease.
- Stale workers must be prevented from finalizing processing after a lease takeover (fencing).

### 4. Event Type Integrity
- Lock takeover query must enforce `type` match.
- Type mismatch between a stored event and a new incoming event with the same ID must be handled as a conflict, not a takeover.

### 5. Error Response Safety
- Webhook route must return generic HTTP responses.
- Raw internal error messages, SQL, tokens, and PII must never be disclosed in the response body.
- Error codes returned to the provider must be stable and documented.

### 6. Aggregate Counter Semantics
- `sentCount` and `errorCount` must handle out-of-order events (e.g., DELIVERED before SENT).
- Counter updates must be atomic and prevent double increments.

## Forbidden shortcuts

- Release lock by `providerEventId` without ownership proof (lease token).
- Stale takeover without `type` check.
- Production legacy secret fallback without ADR.
- Returning raw internal error messages in public responses.
- Marking malformed supported events as `PROCESSED`.
- Treating skipped integration tests as PASS.
- Using Vercel READY status as idempotency certification.
- Claiming migration verified from schema validation alone.
- Claiming concurrency verified from mocked `Promise.all` alone.

## Test Matrix

| Scenario | Expected Result |
| --- | --- |
| Duplicate `email.sent` | Second event ignored (200 OK, `duplicate: true`) |
| `DELIVERED` before `SENT` | Counters reflect correctly; status is `DELIVERED` |
| Lock takeover (stale) | New worker acquires; old worker release fails |
| Production missing Svix | 401 Unauthorized |
| Invalid payload | 400 Bad Request |

## Certification and Post-Merge

Current implementation (PR #905) is classified as **MERGED_UNVERIFIED**. Independent post-merge certification (EMAIL-WEBHOOK-POSTMERGE-VERIFY-001) is required before this domain can be considered launch-ready.
