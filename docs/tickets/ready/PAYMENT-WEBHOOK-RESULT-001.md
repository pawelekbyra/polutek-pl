# PAYMENT-WEBHOOK-RESULT-001 — Fix ignored Stripe webhook use case results

Status: MERGED / HISTORICAL
Ticket ID: PAYMENT-WEBHOOK-RESULT-001
Implementation: PR #902
Merge SHA: 2c2a0f01f71e177145336051e97680bcc489e2b9
Launch status: NO_GO

## Final Historical State

- Status: `MERGED / HISTORICAL`.
- Implementation: PR #902.
- Merge SHA: `2c2a0f01f71e177145336051e97680bcc489e2b9`.
- This ticket is retained as historical evidence only and is not executable.

## Purpose

Fix a critical defect where Stripe webhook orchestration invokes domain use cases but ignores their failure results, leading to silent failures and incorrect idempotency state (marking events as successfully processed when they actually failed).

## Verified Current Control Flow

In `lib/modules/payments/application/handle-stripe-webhook.use-case.ts`:

```typescript
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await fulfillPayment({ ... }, ctx); // result ignored
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund({ ... }, ctx); // result ignored
        break;
      }
      // ...
    }

    // 3. Success Release (Always reached if no exception thrown)
    await lockService.releaseWithSuccess(event.id);
    return ok({ received: true });
```

The `UseCaseResult` returned by `fulfillPayment`, `handleRefund`, and `handleDispute` is not checked. If these return a `fail`, the webhook is still marked as a success in the `StripeEventLockService` and returns a success response to the route.

## Target Behavior

1. The orchestration use case MUST check the result of every inner use case.
2. If an inner use case returns a failure, the orchestration MUST:
   - Log the error.
   - Release the lock with failure (to allow retries if appropriate).
   - Return a failure result to the API route.
3. The API route (`app/api/webhooks/stripe/route.ts`) already handles `result.ok` check, so returning a failure from the use case will trigger the correct error response (500 via `handleApiError`).

## Allowed Paths

- `lib/modules/payments/application/handle-stripe-webhook.use-case.ts`
- `tests/unit/modules/payments/handle-stripe-webhook.test.ts` (or equivalent)

## Disallowed Paths

- Any file outside the Payments module.
- `prisma/schema.prisma`.
- `package.json`.

## Acceptance Criteria

- `handleStripeWebhook` checks `ok` status of `fulfillPayment`.
- `handleStripeWebhook` checks `ok` status of `handleRefund`.
- `handleStripeWebhook` checks `ok` status of `handleDispute`.
- On inner failure, `lockService.releaseWithFailure` is called with the error message.
- On inner failure, `handleStripeWebhook` returns a `fail()` result.
- Focused unit tests prove that a failed fulfillment result leads to a failed webhook result.

## Non-goals

- Implementing an outbox.
- Redesigning `PatronGrant` lifecycle.
- Fixing `EMAIL-WEBHOOK-IDEMPOTENCY-001`.
- Changing `fulfillPayment` logic itself.

## Required focused tests

- Mock `fulfillPayment` to return a `fail`.
- Verify `handleStripeWebhook` returns a failure and calls `releaseWithFailure`.
- Repeat for `handleRefund` and `handleDispute`.

## Original Builder Exit Criteria

The original Builder exit criteria below are historical and no longer make this ticket executable.

- Status after Builder completion was expected to become `READY_FOR_INDEPENDENT_REVIEW`.
- Public launch remains `NO_GO`.
- Evidence: `REPOSITORY_EVIDENCE + AUTOMATED_TEST_EVIDENCE`.
