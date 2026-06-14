# EMAIL-WEBHOOK-LOCK-OWNERSHIP-001 — Add lease ownership and fencing to EmailEvent processing

Status: **CONFIRMED_GAP**
Ticket ID: EMAIL-WEBHOOK-LOCK-OWNERSHIP-001
Dependency: **BLOCKED_BY_POSTMERGE_VERIFICATION**
Launch impact: **HIGH / LAUNCH_BLOCKER**

## Purpose
Add identity to the current worker/attempt to prevent stale workers from finalizing or overwriting the results of newer processing attempts. Implement fencing using a lease token or monotonic version.

## Verified Current Behavior
`EmailEventLockService` acquisition and release only use `providerEventId`. There is no check to ensure the worker releasing the lock is the same one that currently owns it. A worker that timed out can still call `releaseWithSuccess` or `releaseWithFailure`.

## Root Cause
Lack of ownership identity (lease token/attempt ID) in the `EmailEvent` schema and lock service logic.

## Target Behavior
- `acquireLock` returns a `leaseToken` or `attemptId`.
- `releaseWithSuccess`/`releaseWithFailure` must provide the same token/ID.
- Finalization (status update to `PROCESSED` or `FAILED`) occurs ONLY if `providerEventId` AND `leaseToken` match.
- Use `updateMany` for conditional updates (Compare-and-Swap).

## Acceptance Criteria
- Schema updated to include `leaseToken` or `attemptId`.
- Worker A acquires lock.
- Lease expires.
- Worker B re-acquires lock (new token).
- Worker A's finalization attempt is rejected (0 rows updated).
- Worker B can finalize.

## Required Tests
- Integration tests with real PG showing Worker A being "fenced" out after Worker B takeover.
- Unit tests for `release` with invalid tokens.

## Security/Privacy Impact
Prevents data corruption and inconsistent state in the email event ledger.
