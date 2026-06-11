# Reconciliation Report: X1-FIX-005 Full Refund Revokes Linked Grant Only

## Summary
Harden the full refund lifecycle so that a full refund revokes only the PatronGrant linked to the refunded qualifying Payment.

## What changed
- **`lib/modules/patron/domain/patron.dto.ts`**: Updated `RevokePatronInput` to include optional `paymentId`.
- **`lib/modules/patron/infrastructure/patron.repository.ts`**: Added `revokeGrantByPaymentId` to allow targeted revocation of a specific grant.
- **`lib/modules/patron/application/revoke-patron.use-case.ts`**:
    - Refactored to support targeted revocation if `paymentId` is provided.
    - Now uses `recalculatePatronStatus` to update the user's `isPatron` status and other fields based on remaining active grants.
    - Updated audit logging to include `paymentId` and `targeted` flag.
- **`lib/modules/payments/application/handle-refund.use-case.ts`**: Updated `handleRefund` to pass the `paymentId` to `revokePatron` when a full refund occurs.
- **`lib/modules/payments/application/fulfill-payment.use-case.ts`**: Fixed a legacy type error where `SupportedCurrency` was being imported from the wrong location, causing typecheck failures.
- **Tests**:
    - `tests/unit/modules/patron/revoke-patron.test.ts`: Added tests for targeted revocation and preservation of other grants.
    - `tests/unit/modules/payments/handle-refund.test.ts`: Updated to verify that the specific `paymentId` is passed to the revoke use case.

## What did not change
- Partial refund policy remains unimplemented (as requested).
- X2 access truth source remains out of scope.
- Manual revocation (without `paymentId`) still revokes all active grants to preserve existing admin functionality.

## Refund lifecycle evidence
- When a full refund is processed via `handleRefund`, it calls `revokePatron` with the specific `paymentId`.
- `revokePatron` marks only the matching `PatronGrant` as revoked.
- `recalculatePatronStatus` then checks if the user has any other active grants (e.g., from other payments or manual admin grants).
- If other grants exist, `User.isPatron` remains `true`.
- If no other grants exist, `User.isPatron` is set to `false`.

## Tests/validation results
- `npm run quality:architecture-boundaries`: PASSED
- `npm run typecheck`: PASSED
- `npx vitest tests/unit/modules/patron/revoke-patron.test.ts --run`: PASSED
- `npx vitest tests/unit/modules/payments/handle-refund.test.ts --run`: PASSED

## Remaining risks
- If a user has multiple grants for the same payment (should not happen due to `@unique` constraint in schema), all would be revoked if they share the same `paymentId`.
- Partial refund still triggers a full status recalculation, which is safe but doesn't implement a specific "partial refund" business policy.

## Note on Partial Refunds
Partial refund policy remains an owner-level decision gap. Current implementation only decrements totals and recalculates status without specifically revoking linked grants unless the refund becomes full.

## Next recommended ticket
X2-READY-001-access-truth-inventory.md
