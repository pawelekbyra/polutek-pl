# PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001 — Reconciliation Report

Status: COMPLETED_PENDING_REVIEW
Launch status: NO_GO
Date: 2026-06-20

## Summary

Implemented payment fulfillment hardening on current main without continuing PR #996 or PR #997. Payment fulfillment now loads local `Payment` first, treats `Payment.userId` as the receiving user, validates webhook inputs before mutation, and uses a compare-and-set transition for first fulfillment.

## Source-of-truth model

- `Payment` is the financial source of truth.
- `PatronGrant` is the access source of truth.
- Stripe metadata is a consistency input only and cannot choose the access recipient.
- `Payment.userId` stores the Clerk user id directly, matching the `User.id` schema comment and checkout creation path.

## Idempotency model

- `Payment.requestId` was added as nullable legacy-compatible storage.
- `(userId, requestId)` is unique, allowing nullable legacy rows while preventing duplicate checkout attempts for the same user/request pair.
- Pending retries reuse the same local payment and Stripe PaymentIntent.
- Terminal retries return the existing payment status and require a new request id for a new attempt.

## Webhook replay behavior

- First fulfillment atomically transitions `PENDING -> SUCCEEDED` only after local validation.
- Already-succeeded replay is sync-safe and does not increment totals or create another grant.
- Failed/canceled/refunded/disputed/chargeback-lost payments are not converted back to succeeded by the succeeded webhook path.

## Metadata mismatch behavior

If Stripe metadata user id mismatches local `Payment.userId`, fulfillment fails safely before status mutation, totals increment, grant creation, or access sync.

## Legacy fulfillment path decision

The legacy `PaymentFulfillmentService` remains only as a compatibility adapter and delegates to the hardened modular `fulfillPayment` use case. This avoids two independent production fulfillment implementations.

## Docs/control-plane update

The ready queue now advances to `CI-SIGNAL-RECONCILIATION-002`, with `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` remaining after it. Public launch remains `NO_GO`.

## Remaining risks/follow-ups

- Operator Stripe production smoke evidence remains separate and is not satisfied by this code ticket.
- CI-signal reconciliation remains the next executable ticket.
- Full public launch certification remains blocked on X7/operator/legal evidence.
