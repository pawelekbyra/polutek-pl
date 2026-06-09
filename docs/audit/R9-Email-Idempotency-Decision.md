# R9 Email Idempotency Decision

## Current Mode
`best_effort`

## Decision
Durable idempotency is **not fully implemented** in the current schema because the `EmailEvent` model lacks a `unique` constraint on a provider-supplied event ID (e.g., `svix-id` or Resend's internal event ID).

## Why best_effort?
We perform a `findFirst` check on `resendEmailId` + `type` before creating a new `EmailEvent`. This protects against most duplicate state-changing webhooks (like `sent`, `delivered`, `bounced`) but is not atomic and does not use a database-level unique index.

## Risk
- **Race conditions**: Two identical webhook requests processed simultaneously might both pass the `findFirst` check and create duplicate events/increments.
- **Engagement events**: Legitimate repeated `opened` or `clicked` events might be incorrectly deduped if using strict `resendEmailId + type` logic.

## Required Schema Change for Durable Idempotency
To achieve `durable` idempotency, the following migration is recommended:
1. Add `providerEventId String @unique` to `EmailEvent`.
2. Populate this field with `svix-id` (for Resend) or the provider's native event ID.
3. Use `upsert` or `create` with error handling on this unique field.

## Recommended Migration
```prisma
model EmailEvent {
  id               String   @id @default(uuid())
  providerEventId  String?  @unique // New field for durable idempotency
  type             String
  resendEmailId    String?
  // ... rest of fields
}
```

## Test Coverage
Current tests in `tests/unit/modules/email/handle-resend-webhook.test.ts` verify that duplicate state-changing events are ignored based on the `best_effort` strategy.
