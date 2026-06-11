# LAUNCH-FIX-003 — Payment to PatronGrant smoke test

## 1. Summary
This report provides smoke-test evidence that the payment-to-access lifecycle correctly implements the Polutek.pl business rules: a qualifying one-time payment results in a `Payment` fact and an active `PatronGrant` truth, while non-qualifying or duplicate paths do not accidentally grant access.

## 2. Smoke Cases Covered
The following scenarios were verified in `tests/unit/modules/payments/payment-patron-smoke.test.ts`:

- **Evidence 1: Qualifying payment (>= 10 PLN)** creates an active `PatronGrant` and enables access.
- **Evidence 2: Non-qualifying payment (< 10 PLN)** does not create a `PatronGrant` and access remains denied.
- **Evidence 3: Duplicate payment event** is idempotent and does not create duplicate grants.
- **Evidence 4: Full refund** revokes the linked `PatronGrant` and access is subsequently denied.
- **Evidence 5: Access Truth Invariant** confirmed: `User.isPatron: true` alone does not grant access if no active `PatronGrant` exists.

## 3. Payment → PatronGrant Evidence Summary
| Event | Action | Result |
| :--- | :--- | :--- |
| **Successful Qualifying Payment** | `fulfillPayment` | `Payment(SUCCEEDED)` + `PatronGrant(ACTIVE)` |
| **Successful Low Payment** | `fulfillPayment` | `Payment(SUCCEEDED)` + NO `PatronGrant` |
| **Duplicate Webhook** | `fulfillPayment` | `Payment` unchanged + NO new `PatronGrant` |
| **Full Refund** | `handleRefund` | `Payment(REFUNDED)` + `PatronGrant(REVOKED)` |

## 4. Access Truth Confirmation
This verification confirms the X2 standard: **Active PatronGrant is the backend source of truth for patron access.**

- Tests prove that `checkVideoAccess` correctly denies access even when the `User.isPatron` boolean is `true`, if the `PatronRepository` does not return an active grant.
- This ensures that denormalized cache fields cannot leak private content.

## 5. Test Commands Run
```bash
# Focused smoke test
DATABASE_URL="postgresql://dummy" ./node_modules/.bin/vitest --run tests/unit/modules/payments/payment-patron-smoke.test.ts

# Full payment/patron suite
DATABASE_URL="postgresql://dummy" ./node_modules/.bin/vitest --run tests/unit/modules/payments tests/unit/modules/patron
```

## 6. Manual / Production-only Remaining
- Real Stripe webhook signature verification (tested via mocks).
- Real Clerk metadata synchronization (tested via mocks).
- Production environment variable configuration (validated in LAUNCH-FIX-001).

## 7. Blockers Found
- No technical blockers found for the payment-to-access logic.
- Parallel work on X3 (Video) does not conflict with this evidence.

## 8. Readiness Assessment
- **Lane**: `payment/access`
- **Status**: **LAUNCH-CANDIDATE**
- **Recommendation**: MERGE

## 9. Merge Recommendation
**MERGE** — The core payment-to-PatronGrant lifecycle is verified and adheres to architectural invariants.
