# R9 Outbox / Retry Plan

## Current Broadcast Send Model
Broadcasts are currently "fire-and-forget" background tasks triggered after the admin creates the broadcast record. The `EmailService` legacy bridge iterates through recipients and calls the Resend API.

## Fire-and-forget Risks
- **Application restart**: If the server restarts during a long-running broadcast, pending recipients may never be processed.
- **API limits/timeouts**: Network errors or Resend API rate limits can cause chunks of the broadcast to fail without automatic recovery.

## Failure Modes
- `SKIPPED`: User opt-out (handled).
- `FAILED`: Provider error (logged, but requires manual retry).
- `PENDING`: Never reached due to application failure.

## Retry Strategy
Currently, there is no automatic retry. Retries must be triggered manually by an admin by re-initiating the broadcast for `PENDING` or `FAILED` recipients.

## Required Schema
To implement a robust Outbox/Retry system, the following models are recommended:
1. `EmailOutbox`: Stores the intention to send an email, decoupled from the active request.
2. `EmailDeliveryAttempt`: Tracks each attempt to send a specific outbox entry.

## Recommended Future Model
- `PENDING` -> `QUEUED` -> `SENDING` -> `SENT` / `RETRYABLE_FAILURE` / `TERMINAL_FAILURE`.
- Use a dedicated worker process (e.g., a cron job or queue consumer) to process the outbox.
- Implement exponential backoff for `RETRYABLE_FAILURE`.
