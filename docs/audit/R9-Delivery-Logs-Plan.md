# R9 Delivery Logs Plan

## Current Persistence
`EmailEvent` model acts as the primary delivery event log. It stores raw and normalized event data from Resend webhooks.

## What is Logged
- Event type (e.g., `email.sent`, `email.delivered`).
- Resend email ID.
- Recipient email address.
- Full raw payload (as JSON).
- Creation timestamp.

## What is Missing
- **Direct linkage**: Events are linked to broadcast recipients via `resendEmailId` lookup, which is not as performant as a direct foreign key.
- **Human-readable logs**: There is no dedicated UI for viewing detailed delivery logs per broadcast.
- **Provider-specific IDs**: While present in the payload, fields like `svix-id` are not promoted to top-level fields.

## What Requires Schema
- Adding a `broadcastRecipientId` foreign key to `EmailEvent` for better indexing.
- Promoting `providerEventId` to a top-level unique field (see Idempotency Plan).

## Recommended Future Model
1. **Model Promotion**: Ensure every `EmailEvent` is linked to a `BroadcastEmailRecipient`.
2. **Metadata Enhancement**: Log metadata like `subject`, `provider`, and `attemptNumber`.
3. **Audit Alignment**: Ensure critical delivery failures trigger `AuditLog` events for admin visibility.
