# Reconciliation Report: LAUNCH-FIX-007 Stripe Refund & Dispute PatronGrant Lifecycle Smoke Test

## Status
Merge recommendation: **MERGE**
Lane: **launch-ops**
Launch-readiness: **LAUNCH-CANDIDATE**

## Summary
This report provides automated evidence that the Stripe refund and dispute lifecycle correctly manages `PatronGrant` access truth. We have hardened the dispute lifecycle to include suspension (dispute opened) and reactivation (dispute won), ensuring that access is correctly denied and restored according to the financial state without relying on denormalized caches.

## Lifecycle Matrix Evidence
Verified via `tests/unit/modules/payments/stripe-lifecycle-smoke.test.ts`:

| Case | Payment Status | PatronGrant State | Access Truth (Backend) |
| :--- | :--- | :--- | :--- |
| **Qualifying Payment** | `SUCCEEDED` | `ACTIVE` | `ALLOWED` |
| **Full Refund** | `REFUNDED` | `REVOKED` | `DENIED` |
| **Dispute Opened** | `DISPUTED` | `REVOKED` (Suspended) | `DENIED` |
| **Dispute Won** | `SUCCEEDED` | `ACTIVE` (Reactivated) | `ALLOWED` |
| **Dispute Lost** | `CHARGEBACK_LOST` | `REVOKED` | `DENIED` |
| **Partial Refund** | `PARTIALLY_REFUNDED` | `ACTIVE` | `ALLOWED` |

## Core Invariants Validated
1.  **`Payment != PatronGrant != Subscription`**: Payment records remain as immutable financial facts even when access is revoked.
2.  **Active PatronGrant is Truth**: `getPatronStatus` was hardened to ignore the `User.isPatron` cache and rely solely on `activeGrants.length > 0`.
3.  **Idempotency**: Duplicate refund or dispute events do not cause duplicate side effects or incorrect state transitions.
4.  **Isolation**: Events only affect the `PatronGrant` linked to the specific payment; unrelated grants (e.g., from other payments or admin actions) remain unaffected.
5.  **Negative Access**: Stale `User.isPatron: true` or Clerk metadata alone cannot restore access if the backend truth (`PatronGrant`) is missing or revoked.

## Runtime Changes
- **`PatronRepository`**: Added `reactivateGrantByPaymentId` to support restoring access after a won dispute.
- **`handleDispute` Use Case**:
    - Now revokes the linked grant on dispute opened (Suspension).
    - Now reactivates the linked grant on dispute won.
    - Standardized revocation on dispute lost via repository.
    - Forces status recalculation and Clerk sync on all dispute transitions.
- **`getPatronStatus` Use Case**:
    - **BUG FIX**: Hardened to derive `isPatron` truth from `activeGrants.length > 0` instead of trusting `user.isPatron`. This ensures that even if the denormalized cache drifts, the backend access check remains correct.

## Partial Refund Status
- **Current Behavior**: Partial refunds decrement the user's total paid amount and trigger a status recalculation but **do not** revoke the linked grant unless the refund is full.
- **Policy Note**: This is consistent with the "Patronage is a reward for a qualifying donation... permanent/lifetime by default" policy. No new partial-refund revocation policy was implemented.

## Validation Results
- `npm test -- --run tests/unit/modules/payments tests/unit/modules/patron`: **PASSED** (40 tests)
- `npm run typecheck`: **PASSED**
- `npm run quality:architecture-boundaries`: **PASSED**

## Remaining Risks
- **Signature Validation**: Verified in `handleStripeWebhook` route boundary via `ConstructEvent`.
- **Deduplication**: Verified via `StripeEvent` lock service (Idempotency ledger).

## Next Recommended Ticket
- `X3-FIX-011-cloudflare-signed-playback-runtime` (Parallel work completion)
- Admin reconciliation dashboard for manual grant/refund audits.

## Final Assessment
The refund and dispute lifecycle is now robust and provides the necessary evidence for public launch. Access truth is strictly enforced via `PatronGrant`.
