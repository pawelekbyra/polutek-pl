# PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001 — Reconciliation Report

Date: 2026-06-20
Ticket: `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001`
Launch status: `NO_GO`

## Summary

Implemented payment fulfillment hardening for Stripe one-time support payments before production payment smoke testing is treated as meaningful.

## Intent

Make `Payment` the financial source of truth and `PatronGrant` the access truth. Stripe webhook metadata is only a consistency signal and does not select the user that receives totals or access.

## Changed files

- `prisma/schema.prisma`
- `prisma/migrations/20260620000100_payment_request_id/migration.sql`
- `lib/modules/payments/domain/payment.dto.ts`
- `lib/modules/payments/infrastructure/payment.repository.ts`
- `lib/modules/payments/application/create-checkout-intent.use-case.ts`
- `lib/modules/payments/application/fulfill-payment.use-case.ts`
- `lib/modules/payments/application/handle-stripe-webhook.use-case.ts`
- `app/api/checkout/create-intent/route.ts`
- `app/api/payments/[paymentId]/route.ts`
- `app/components/VideoPlaylist.tsx`
- `app/components/playlist/CheckoutModal.tsx`
- `tests/unit/modules/payments/fulfill-payment.use-case.test.ts`
- `tests/unit/modules/payments/payment-access-smoke.test.ts`
- `tests/unit/modules/payments/webhook-orchestration.test.ts`
- `docs/tickets/ready/README.md`
- `docs/tickets/ready/PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001.md`

## Scope confirmation

Work stayed within the ticket's allowed paths. Patronage remains a qualifying one-time support/payment, not a recurring subscription product. Public launch remains `NO_GO`.

## Code decisions

- Fulfillment loads the local `Payment` first.
- Local `Payment.userId`, amount, currency, status, and Stripe intent id are validated before any `SUCCEEDED` mutation.
- Stripe metadata user id mismatch fails safely and does not grant access.
- Fulfillment increments user totals and creates `PatronGrant` for `payment.userId` only.
- Duplicate succeeded webhooks are no-op/sync-only and do not double increment totals or duplicate grants.
- Checkout request idempotency now uses explicit `Payment.requestId` with a unique index.
- Reusing a completed/failed/canceled request id returns the existing terminal payment response; retries require a new request id.
- Return-from-Stripe UI checks `/api/payments/[paymentId]` and distinguishes pending webhook, succeeded, failed/canceled, refunded/disputed, and access sync pending.

## Validation

Validation commands were run locally and are reported in the PR/final response.

## What did not change

- No live Stripe smoke test was performed.
- No legal/terms copy changed.
- Public launch status was not changed from `NO_GO`.
- Patronage was not converted into a recurring subscription.

## Risks and follow-ups

- Production Stripe smoke evidence remains an operator evidence task after this code hardening lands.
- Payment status UI is intentionally minimal and can be polished in a later UX ticket.

## Ticket status

`COMPLETED_PENDING_REVIEW`

## PR #996 repair review (2026-06-20)

- Merge-conflict repair preserved PR #995 architecture audit routing, `CI-SIGNAL-RECONCILIATION-002`, admin-auth wrapper routing, strict-escapes/hotspot routing, and public launch `NO_GO`.
- `Payment.userId` stores the Clerk-backed local `User.id`; `prisma/schema.prisma` documents `User.id` as the Clerk user id directly, and checkout creates `Payment.userId` from `auth().userId` after `getOrCreateCurrentUser`.
- `GET /api/payments/[paymentId]` therefore queries by authenticated Clerk user id and payment id together, returns `401` when unauthenticated, and returns `404` when ownership does not match.
- Stripe return URL carries `payment_id`, and polling does not claim access is synced unless the succeeded payment has an active `PatronGrant`.
- Legacy `PaymentFulfillmentService.fulfillPayment` now delegates to the hardened modular `fulfillPayment` use case instead of keeping a second metadata-trusting production fulfillment implementation.
- `requestId` idempotency remains explicit through `Payment.requestId`; same-user reuse returns pending or terminal stable responses, while cross-user lookup is scoped by `userId`.
