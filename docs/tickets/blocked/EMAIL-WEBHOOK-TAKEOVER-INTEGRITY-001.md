# EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001 — Enforce event type integrity during lock takeover

Status: **CONFIRMED_GAP**
Ticket ID: EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001
Dependency: **BLOCKED_BY_LOCK_DESIGN**
Launch impact: **HIGH**

## Purpose
Ensure that when a stale or failed lock is taken over, the new event's type matches the existing record's type to prevent processing a payload under the wrong event context.

## Verified Current Behavior
`EmailEventLockService.acquireLock` attempts takeover using `providerEventId` but does not strictly include `type` in the `updateMany` where clause. While it checks the type later, the takeover might have already happened for a different type.

## Target Behavior
- Takeover query MUST include `type: event.type`.
- If types mismatch, the takeover must fail and return `CONFLICT` or a specific error.
- Generate a structured alert on type mismatch for the same `providerEventId`.

## Acceptance Criteria
- Takeover only succeeds if `type` matches.
- Mismatch results in `CONFLICT`.
- No silent processing of mismatched payloads.
