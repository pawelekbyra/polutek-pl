# EMAIL-WEBHOOK-COUNTER-SEMANTICS-001 — Define and enforce broadcast aggregate counter semantics

Status: **DECISION_REQUIRED**
Ticket ID: EMAIL-WEBHOOK-COUNTER-SEMANTICS-001
Launch impact: **MEDIUM_TO_HIGH**

## Purpose
Define how `sentCount` and `errorCount` are updated in `BroadcastEmail` to handle out-of-order webhook delivery (e.g., `DELIVERED` arriving before `SENT`).

## Finding
`sentCount` is currently incremented when an `email.sent` event is processed. If `email.delivered` arrives first, the state may already be advanced, potentially skipping the `sentCount` increment.

## Target Behavior
- Deterministic rules for counter increments.
- Handlers for all event ordering permutations.
- Ensure `sentCount` accurately reflects the number of messages that reached at least the `SENT` state.

## Acceptance Criteria
- Defined semantics for counters.
- Correct counts regardless of event arrival order.
- No double increments.
