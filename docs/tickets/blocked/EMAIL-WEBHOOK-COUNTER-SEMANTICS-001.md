# EMAIL-WEBHOOK-COUNTER-SEMANTICS-001 — Define and enforce broadcast aggregate counter semantics

* **Status**: DECISION_REQUIRED
* **Ticket ID**: EMAIL-WEBHOOK-COUNTER-SEMANTICS-001
* **Role**: Builder
* **Launch impact**: MEDIUM_TO_HIGH

## Purpose
Define how `sentCount` and `errorCount` are updated in `BroadcastEmail` to handle out-of-order webhook delivery and ensure accurate reporting.

## Verified current behavior
`sentCount` is currently incremented upon receiving the `email.sent` event. If `email.delivered` arrives first, the recipient status may advance to `DELIVERED`, and a subsequent `SENT` event might not trigger the increment.

## Root cause
Counter logic is tied to specific event types rather than state transitions or occupancy.

## Risk
Undercounting of sent messages or double-counting if retries are not handled correctly.

## Dependencies
- `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`
- **Owner decision required** (BLOCKER)

## Owner decisions required
- Does `sentCount` mean "provider accepted the request" or "exactly email.sent event received"?
- Definition of `errorCount` (Permanent failure vs transient retry).
- Priority of events (e.g., does `BOUNCED` override `SENT` counters?).

## Candidate Definitions
1. **Event-Exact**: Count only when the specific event arrives.
2. **Occupancy-Based**: Count if recipient is in state >= SENT.
3. **Transition-Based**: Count on first transition to a "dispatched" state.

## Allowed paths
- `lib/modules/email/application/handle-resend-webhook.use-case.ts`
- `lib/modules/email/domain/email-policy.ts`
- `tests/unit/modules/email/handle-resend-webhook.test.ts`

## Disallowed paths
- `lib/modules/payments/**`
- `prisma/**`

## Target behavior
**Implementation forbidden before owner approval.** Once approved, implement a transition-safe counter update that handles all 7 supported event types.

## Detailed acceptance criteria
1. No double increments for the same recipient.
2. Correct aggregate counts for `SENT -> DELIVERED` sequence.
3. Correct aggregate counts for `DELIVERED -> SENT` (out of order).
4. `errorCount` accurately reflects terminal failures.
5. Reconciliation strategy for existing inaccurate counts.

## Required unit tests
- SENT -> DELIVERED.
- DELIVERED -> SENT.
- OPENED -> SENT.
- BOUNCED -> SENT.
- Property-based tests for all 5040 permutations of event arrival (subset).

## Required integration tests
- Real DB test for concurrent increments on `BroadcastEmail` record.

## Required negative tests
- Duplicate event arrival does not increment counters.

## Migration impact
May require a reconciliation script to fix counts on existing `BroadcastEmail` rows.

## Security/privacy impact
None.

## Observability requirements
- Audit log entry for significant counter deviations.

## Rollout/rollback requirements
- Standard deploy.

## Non-goals
- Fixing lock ownership.

## Required evidence
- Unit test matrix for all arrival order permutations.

## Exit state
`IMPLEMENTED_VERIFIED` after owner approval and evidence.
