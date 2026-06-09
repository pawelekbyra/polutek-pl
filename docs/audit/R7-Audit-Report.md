# R7 Patron + Payments Architecture Audit Report

## 1. Executive Verdict
- **Can start R7 architecture audit:** YES (Complete)
- **Can start R7 implementation:** NO (Awaiting final mapping of refund/dispute and Patron module structure)
- **R7 current status:** [~ architecture audit started]
- **Main blocker:** Lack of formal module boundaries and clear Source-of-Truth for Patron status.
- **Recommended next prompt:** R7 Payments + Patron Module Foundation Implementation

## 2. Current R7 Inventory

| Flow | Files/Functions | Status |
| :--- | :--- | :--- |
| **Checkout** | `app/api/checkout/create-intent/route.ts`, `PaymentCheckoutService.createPayment` | Legacy Service |
| **Stripe Webhook** | `app/api/webhooks/stripe/route.ts`, `PaymentService.handleWebhook` | Legacy Service |
| **Fulfillment** | `PaymentFulfillmentService.fulfillPayment` | Legacy Service |
| **Refund** | `PaymentRefundService.calculateRefundAdjustment`, `PaymentService.handleRefund` | Legacy Service |
| **Dispute** | `PaymentRefundService.applyLostChargeback`, `PaymentService.handleDispute` | Legacy Service |
| **Patron Grant** | `lib/services/patron.service.ts`: `grantPatronStatus` | Legacy Service |
| **Patron Revoke** | `lib/services/patron.service.ts`: `revokePatronStatus` | Legacy Service |
| **Admin Patron** | `app/api/admin/users/[userId]/patron/route.ts` | Legacy Route |
| **Payment Settings**| `app/api/admin/payment-settings/route.ts` | Legacy Route |
| **Clerk Sync** | `UserAccessService.syncClerkAccess` | Legacy Service |
| **Email Dep.** | `EmailService` (legacy bridge) | Bridge |
| **Audit/Obs.** | `audit.service.ts`, `observability.ts` | Integrated |

## 3. Checkout Audit
- **Auth:** Required (via Clerk `auth()`).
- **User Sync:** Uses modular bridge `getOrCreateCurrentUser`.
- **CreatorId:** Server-side resolved via `MainChannelService.getRequired()`. **DO NOT TRUST CLIENT creatorId.**
- **Validation:** Zod-based `checkoutSchema` + DB limits in `validatePaymentAmountMinorAsync`.
- **Idempotency:** Supported via `requestId` in metadata and Stripe idempotency keys.
- **Risk Level:** Low.

## 4. Stripe Webhook Audit
- **Signature:** Required and verified using `STRIPE_WEBHOOK_SECRET`.
- **Idempotency:** Implemented via `StripeEvent` table with `PROCESSING/PROCESSED/FAILED` statuses.
- **Race Conditions:** Handles stale events (>10 mins) and duplicate success events.
- **Risks:** Won disputes do not automatically restore PatronGrants if they were manually revoked (P1).
- **Risk Level:** Medium (complexity in state transitions).

## 5. Fulfillment Audit
- **Replay Safety:** Uses `updateMany` for status CAS (PENDING -> SUCCEEDED).
- **CAS Guards:** `userPaymentTotal` uses `upsert` and atomic `increment`.
- **Patron Grant:** Currently, any successful one-time tip grants Patron status.
- **Source-of-Truth:** DB is the source; Clerk sync is post-transaction and handled as cache.
- **Risk Level:** Low.

## 6. Patron Service Audit
- **Idempotency:** `grantPatronStatus` is idempotent for `paymentId` and `referralId`.
- **Grants:** `PatronGrant` records are the permanent record of why status was granted.
- **Revoke:** Revokes all active grants for the user.
- **Risk Level:** Medium (denormalized `User.isPatron` can drift from `PatronGrant` state).

## 7. Refund/Dispute Safety
- **Refund Safety:** OK. Uses `calculateRefundAdjustment` to prevent double-refunds and over-refunds.
- **Dispute Safety:** OK. Marks as `CHARGEBACK_LOST` and revokes related grants.
- **Idempotency:** Supported via Stripe event locking.
- **Risks:** Partial refunds do not currently revoke Patron access (intentional until threshold model).
- **Risk Level:** Medium.

## 8. Source-of-Truth Recommendation
- **Current Truth:** `User.isPatron` boolean flag.
- **Target Truth:** Active records in `PatronGrant`. `User.isPatron` becomes a denormalized read-model.
- **Migration Strategy:** Staged. First, all updates go through Patron module. Then, Access module reads from a `PatronStatus` use case.
- **Why:** To ensure auditable history of grants and handle multi-source access (payments, referrals, admin).

## 9. Recommended R7 Module Architecture

### Payments Module (`lib/modules/payments`)
- **Application:** `CreateCheckoutIntent`, `HandleStripeWebhook`, `FulfillPayment`, `HandleRefund`, `HandleDispute`.
- **Domain:** `PaymentDto`, `PaymentStatus`, `StripeEventDto`.
- **Infrastructure:** `PaymentRepository`, `StripeProvider`.

### Patron Module (`lib/modules/patron`)
- **Application:** `GrantPatron`, `RevokePatron`, `RecalculatePatronStatus`, `GetPatronStatus`.
- **Domain:** `PatronGrantDto`, `PatronPolicy`.
- **Infrastructure:** `PatronRepository`.

## 10. Access Integration Plan
- **Current:** `checkVideoAccess` reads `User.isPatron`.
- **Target:** `checkVideoAccess` calls `PatronModule.getPatronStatus(userId)`.
- **Staged Migration:** Maintain `User.isPatron` in DB for now, but strictly control its updates via the Patron module.

## 11. Validation Results
- **Prisma Validate:** PASS (in local, sandbox lacks ENV).
- **Architecture Boundaries:** PASS (with updated allowlist).
- **Typecheck:** PASS.
- **Tests:** ALL PASS (Modular + Legacy Payments/Patron).
- **Lint:** PASS.
- **Build:** PASS.
