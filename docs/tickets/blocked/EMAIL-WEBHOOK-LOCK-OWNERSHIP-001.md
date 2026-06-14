# EMAIL-WEBHOOK-LOCK-OWNERSHIP-001 — Add lease ownership and fencing to EmailEvent processing

* **Status**: CONFIRMED_GAP
* **Ticket ID**: EMAIL-WEBHOOK-LOCK-OWNERSHIP-001
* **Role**: Builder
* **Launch impact**: HIGH / LAUNCH_BLOCKER

## Purpose
Add identity to the current worker/attempt to prevent stale workers from finalizing or overwriting the results of newer processing attempts. Implement fencing using a lease token or monotonic version.

## Verified current behavior
`EmailEventLockService` acquisition and release only use `providerEventId`. There is no check to ensure the worker releasing the lock is the same one that currently owns it. A worker that timed out can still call `releaseWithSuccess` or `releaseWithFailure`.

## Root cause
Lack of ownership identity (lease token/attempt ID) in the `EmailEvent` schema and lock service logic.

## Risk
Stale workers (10m+ processing) can overwrite correct results from newer attempts, leading to data corruption in the email event ledger and incorrect broadcast counters.

## Dependencies
- `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001` (to document baseline failure)

## Owner decisions required
- Choice between `leaseToken` (UUID/random) vs monotonic `lockVersion` for fencing.
- Decision on `staleThreshold` (currently 10m).
- Need for a `heartbeatPolicy`.

## Allowed paths
- `lib/modules/email/infrastructure/email-event-lock.service.ts`
- `prisma/schema.prisma` (Add `leaseToken` or `lockVersion`, `attemptCount`)
- `tests/integration/email-event-idempotency.test.ts`
- `tests/unit/modules/email/email-event-lock.repository.test.ts`

## Disallowed paths
- `app/api/**` (except where type changes require it)
- `lib/modules/payments/**`
- `lib/modules/patron/**`

## Target behavior
A worker may finalize only when `providerEventId` and `eventType` match, and its `leaseToken` (or version) matches the current state in the database. Every acquisition attempt must increment an `attemptCount` and generate a new `leaseToken`.

## Detailed acceptance criteria
1. `EmailEvent` schema includes `leaseToken` (String?) and `lockVersion` (Int, default 0).
2. `acquireLock` returns the new `leaseToken`/`lockVersion`.
3. `releaseWithSuccess` and `releaseWithFailure` REQUIRE the token/version.
4. Finalization uses `updateMany` with a where clause matching the token/version.
5. If `updateMany` count is 0, service returns `LOST_OWNERSHIP`.
6. Stale worker trying to finalize after a takeover fails.
7. `processedAt` and `error` fields are reset upon successful lock re-acquisition (takeover).
8. Cleanup policy for expired locks is defined.

## Required unit tests
- `acquireLock` increments version/token.
- `release` with matching token succeeds.
- `release` with non-matching token returns error.
- Takeover of `FAILED` status resets error and processedAt.

## Required integration tests
- Two independent Prisma clients simulating concurrent workers.
- Two real PostgreSQL connections.
- Worker A acquires, Worker B takes over (stale), Worker A fails to release.

## Required negative tests
- Concurrent acquire returns `CONFLICT`.
- Concurrent release with stale token results in 0 rows updated.

## Migration impact
- Schema update required.
- Legacy rows need a migration to set default `lockVersion` or `leaseToken`.

## Security/privacy impact
Prevents race conditions that could lead to unauthorized state changes or duplicate event processing.

## Observability requirements
- log `attemptId` or a non-reversible/short fingerprint of the lease token;
- never log the raw lease token;
- never log secrets, raw payloads, email addresses, or PII;
- metric:
  email.lock.ownership_lost;
- structured operational fields:
  providerEventId fingerprint,
  eventType,
  attemptId,
  result,
  duration.

## Rollout/rollback requirements
- Standard Prisma migration deploy.
- Rollback requires reverting schema change.

## Non-goals
- Implementing an outbox.
- Fixing `sentCount` increment logic.
- Adding production Svix verification.

## Required evidence
- Real PostgreSQL concurrency trace proving fencing.
- PR report with unit/integration test results.

## Exit state
`IMPLEMENTED_VERIFIED` after Certifier review of the fencing proof.
