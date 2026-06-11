# Launch Evidence: LAUNCH-FIX-003 Payment to PatronGrant Smoke Test

## Status
Merge recommendation: **MERGE**
Lane: **launch-ops**
Launch-readiness: **LAUNCH-CANDIDATE**

## Summary
This report provides smoke-test evidence that the payment-to-access lifecycle correctly enforces the `Payment != PatronGrant != Subscription` invariant. We have verified that qualifying payments create access truth via active `PatronGrant` records, while under-threshold or non-qualifying events do not accidentally grant access.

## Smoke Cases Covered
Verified via `tests/unit/modules/payments/payment-access-smoke.test.ts`:

1.  **Qualifying Payment Enforces Access Truth**: A payment meeting the threshold (e.g., 10.00 PLN) results in a `Payment(SUCCEEDED)` fact and an active `PatronGrant`. `getPatronStatus` correctly reports the user as a patron.
2.  **Under-Threshold Payment Denial**: A payment below the threshold (e.g., 5.00 PLN) results in a `Payment(SUCCEEDED)` financial fact but **no** `PatronGrant`. The user remains a non-patron.
3.  **Idempotency & Replay Safety**: Replayed webhook events for an already succeeded payment do not create duplicate grants or financial facts.
4.  **Revocation Integrity**: Revoking a grant (e.g., via admin action or refund) correctly blocks access even if the original successful `Payment` fact remains in the system.
5.  **Truth Source Confirmation**: `getPatronStatus` (and thus `checkVideoAccess`) relies on active `PatronGrant` lookup, proving that `User.isPatron` and Clerk metadata are secondary cache/diagnostic fields.

## Access Truth Confirmation
- **Payment Fact**: Recorded in the `Payment` table (financial history).
- **Access Truth**: Recorded in the `PatronGrant` table (active access).
- **Cache/Badge**: `User.isPatron` and Clerk metadata are synced for performance but not used for backend access gating in `checkVideoAccess`.

## Test Commands Run
```bash
# Targeted smoke and unit tests
npm test -- tests/unit/modules/payments/payment-access-smoke.test.ts tests/unit/modules/payments tests/unit/modules/patron --run

# Full validation suite
npm run quality:architecture-boundaries
npm run typecheck
```
All 34 tests in the payment/patron modules passed.

## What Remains Manual/Production-Only
- **Live Stripe Integration**: Live webhook delivery and real card processing must be smoke-tested in the production environment (as part of `LAUNCH-FIX-001` and `LAUNCH-FIX-002`).
- **Dispute/Chargeback**: While the `handleRefund` and `handleDispute` (lost) logic is unit-tested, real chargeback events require production monitoring.

## Blockers Found
- **None**: The payment-to-access lane is technically sound and adheres to the required safety standard.

## Final Assessment
The payment and access lane is **launch-candidate**. The system correctly distinguishes between receiving money and granting access, ensuring that only qualifying supporters receive patron benefits.

## Merge Recommendation
**MERGE** - Smoke evidence is complete and validation passed.
