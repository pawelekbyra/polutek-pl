# EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001 — Enforce event type integrity during lock takeover

* **Status**: CONFIRMED_GAP
* **Ticket ID**: EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001
* **Role**: Builder
* **Launch impact**: HIGH

## Purpose
Ensure that when a stale or failed lock is taken over, the new event's type matches the existing record's type to prevent processing a payload under the wrong event context.

## Verified current behavior
`EmailEventLockService.acquireLock` attempts takeover using `providerEventId` but does not strictly include `type` in the `updateMany` where clause during the recovery path. Mismatched types could be "acquired" if they share an ID.

## Root cause
The `updateMany` filter in the recovery branch of `acquireLock` lacks a check on the `type` field.

## Risk
Processing an `email.sent` payload as an `email.delivered` event (or vice versa) if the provider reuses event IDs across types or if malformed data arrives.

## Dependencies
- `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001` (Dependency for lock design)

## Owner decisions required
- Classification of type mismatch: Permanent failure or transient retry?

## Allowed paths
- `lib/modules/email/infrastructure/email-event-lock.service.ts`
- `tests/unit/modules/email/email-event-lock.repository.test.ts`

## Disallowed paths
- `app/api/webhooks/resend/route.ts`
- `prisma/**` (Logic change only)

## Target behavior
Takeover query MUST include `type: event.type` in the `where` clause. If a record with the same `providerEventId` exists but has a different `type`, the acquisition must fail with a deterministic mismatch signal.

## Detailed acceptance criteria
1. `updateMany` in the takeover path includes `type: event.type`.
2. Mismatch results in `CONFLICT` or a new `INTEGRITY_MISMATCH` status.
3.Mismatched takeover attempt triggers a structured alert.
4. Acquisition returns `CONFLICT` if the ID exists but the type is different, even if the status is `FAILED`.

## Required unit tests
- Acquire lock for `event_a` with ID `123`.
- `event_a` fails.
- Try to acquire lock for `event_b` with ID `123`.
- Verify takeover fails and returns mismatch status.

## Required integration tests
- Real DB test proving `updateMany` does not update rows with mismatched types.

## Required negative tests
- Mismatched event types for the same recipient and provider ID.

## Migration impact
None. Logic-only change.

## Security/privacy impact
Prevents logic errors that could lead to incorrect data being stored in the event ledger.

## Observability requirements
- Alert for `email.webhook.type_mismatch`.

## Rollout/rollback requirements
- Standard code deploy.

## Non-goals
- Adding lease ownership.
- Defining counter semantics.

## Required evidence
- Unit test coverage for the takeover filter.

## Exit state
`IMPLEMENTED_VERIFIED` after logic verification.
