# PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001 — Stripe fulfillment, idempotency and PatronGrant hardening

Ticket ID: PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001
Status: DONE_BY_PR_998 / HISTORICAL
Role: Builder
Priority: Historical evidence only — not executable
Launch status: NO_GO
Type: Runtime implementation + focused tests

## Current-state reconciliation

This ticket is no longer executable. PR #998 merged the payments fulfillment/idempotency hardening work, including local `Payment` source-of-truth validation, checkout `requestId` idempotency, owner-only payment status polling, and replay-safe fulfillment behavior.

The current executable queue remains only in `docs/tickets/ready/README.md`. Public launch remains `NO_GO`; Stripe production smoke/operator evidence remains separate.

## Product decision

This code ticket was created from current-main code review. The existing `LAUNCH-FIX-003-payment-to-patrongrant-smoke-test.md` is docs-only/operator evidence and must remain separate. Before production smoke testing payments, the code path needed hardening so fulfillment could not mark a payment succeeded before validating the Stripe event and could not grant access to the wrong user from mutable webhook metadata.

Patronage remains a qualifying one-time support/payment. `Payment` is the financial fact; `PatronGrant` is access truth. There is no recurring subscription product in this ticket.

## Current-main risk evidence

- `fulfillPayment` currently fetches the user from webhook input `userId` before loading local `Payment`.
- It updates local payment status `PENDING -> SUCCEEDED` before verifying amount and currency.
- Patron totals and grants are updated using input `userId` instead of treating local `payment.userId` as source of truth.
- Frontend/backend idempotency by checkout `requestId` is incomplete.

## Goal

Make Stripe payment fulfillment safe, replay-proof, and aligned with `Payment` and `PatronGrant` as backend truth before any production payment smoke test is treated as meaningful.

## Required implementation

### A. Source-of-truth fulfillment

- `fulfillPayment` must load local `Payment` by `paymentId` first.
- Treat local `Payment.userId`, `Payment.amountMinor`, `Payment.currency`, `Payment.status`, and stored Stripe intent id as source of truth.
- Stripe metadata `userId` may be used only as a consistency check. If it does not match local `payment.userId`, fail safely and do not grant access.
- User totals and PatronGrant must be updated for `payment.userId`, not webhook metadata user id.

### B. Validation before status mutation

- Verify payment exists, amount matches, currency matches, Stripe intent matches, and status is fulfillable before setting `SUCCEEDED`.
- Use atomic compare-and-set with all relevant predicates where practical.
- Replay of an already `SUCCEEDED` payment must be no-op/sync-only and must not double-increment totals or duplicate PatronGrant.
- Non-fulfillable states such as failed/refunded/disputed must not be mutated by succeeded replay.

### C. Checkout request idempotency

- Generate and send a stable `requestId` per checkout attempt from the client.
- Persist requestId in a queryable local field or a safe equivalent; prefer explicit schema over JSON-only lookup if current implementation cannot guarantee uniqueness.
- Reusing the same requestId must not create another local payment or another PaymentIntent.
- Define behavior for retrying after failed/canceled payment: require a new requestId or return a stable terminal response.

### D. Payment status UI/API

- Add a user-owned payment status endpoint or equivalent query so return-from-Stripe UI checks a specific payment, not only `success=true`.
- UI must distinguish pending webhook, succeeded, failed/canceled, refunded/disputed, and access sync pending.

### E. Refund/dispute regression

- Ensure refunds and disputes use local Payment as source of truth.
- Full refund must revoke the grant linked to that payment.
- Partial refund must recalculate access according to the current product rule.
- Dispute open/lost/won must be idempotent and auditable.

## Non-goals

- Do not convert patronage into a recurring subscription.
- Do not perform live Stripe smoke testing in this code ticket.
- Do not change legal/terms copy.
- Do not log secrets, client secrets, raw webhook payloads, or card data.

## Allowed paths

- `app/api/checkout/**`
- `app/api/payments/**`
- `app/api/webhooks/stripe/**`
- `app/components/**Checkout**`
- `app/components/**Payment**`
- `app/components/VideoPlaylist.tsx` if it owns checkout UI
- `lib/modules/payments/**`
- `lib/modules/patron/**`
- `lib/services/user-access.service.ts`
- `lib/payments/**`
- `prisma/schema.prisma` and `prisma/migrations/**` if requestId/status support requires schema
- `tests/unit/modules/payments/**`
- `tests/unit/**payment**`
- `tests/unit/**stripe**`
- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**` for status updates

## Acceptance criteria

- Fulfillment never marks payment succeeded before validation.
- Fulfillment never grants Patron access to metadata user when local payment belongs to another user.
- Duplicate webhook and duplicate checkout request do not duplicate totals or grants.
- UI can show status of a specific payment.
- Refund/dispute behavior remains safe and tested.

## Validation

- `git diff --check`
- `npx prisma validate` and `npx prisma generate` if schema changes are made
- `npm run typecheck`
- `npm run lint`
- `npm test -- payments`
- targeted webhook/idempotency/refund/dispute tests
- `npm run build`

## Expected PR report

Include code decisions, schema changes if any, idempotency behavior, tests, unresolved provider/operator evidence, and confirmation that public launch remains `NO_GO`.
