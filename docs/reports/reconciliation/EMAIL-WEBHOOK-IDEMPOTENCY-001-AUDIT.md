# Audit Report: EMAIL-WEBHOOK-IDEMPOTENCY-001

**Status:** CONFIRMED / IMPLEMENTATION_REQUIRED
**Ticket ID:** EMAIL-WEBHOOK-IDEMPOTENCY-001
**Date:** 2026-06-13
**Auditor:** Jules (AI Technical Orchestrator)

## Executive Summary

This audit confirms that the problem described in `EMAIL-WEBHOOK-IDEMPOTENCY-001` (Resend Webhook Idempotency and Race Conditions) is a **real and present technical defect** in the current `main` branch.

While the current implementation in `handle-resend-webhook.use-case.ts` includes a "best-effort" idempotency check and a status hierarchy, it lacks **atomic guarantees**. The system is vulnerable to race conditions where concurrent webhooks for the same event can bypass the check, leading to duplicate event logs and potentially corrupting aggregate counters in the `BroadcastEmail` model.

## Evidence

### 1. Non-Atomic "Check-then-Act" Pattern
The idempotency check in `lib/modules/email/application/handle-resend-webhook.use-case.ts` (lines 40-58) is not atomic. It performs a database read (`findFirst`) followed by a write (`create`).
In a concurrent execution environment (common in serverless platforms like Vercel), two or more instances of the webhook handler can simultaneously determine that an event does not exist and proceed to process it multiple times.

### 2. Missing Unique Constraints in Schema
The `EmailEvent` model in `prisma/schema.prisma` lacks any unique constraints on provider-side identifiers.
```prisma
model EmailEvent {
  id               String   @id @default(uuid())
  type             String
  resendEmailId    String?
  // ...
  @@index([resendEmailId]) // Index exists, but it is NOT UNIQUE
}
```
Without a unique constraint (e.g., on `resendEmailId` + `type` or a specific `providerEventId`), the database cannot act as a final guard against duplicate ingestion.

### 3. Non-Atomic Aggregate Updates
The `updateRecipientStatus` function (lines 142-176) reads the current status and then performs an update. This "read-then-update" pattern is also non-atomic, specifically affecting the increment logic for `sentCount` and `errorCount` in the `BroadcastEmail` model. Concurrent "first-time" status updates could result in double-counting.

### 4. Missing Unique Event ID Persistence
The `svix-id` (the canonical unique ID from Resend/Svix) is extracted in the API route but is **not stored** as a unique identifier in the `EmailEvent` model, making exact-match deduplication impossible.

## Code References

*   **Weak Idempotency Check**: `lib/modules/email/application/handle-resend-webhook.use-case.ts`
*   **Schema Definition**: `prisma/schema.prisma`
*   **Webhook Entry Point**: `app/api/webhooks/resend/route.ts`

## Reproduction Path

1.  **Event**: Resend sends two identical `email.delivered` webhooks for the same `email_id` in rapid succession (due to network retries or provider-side behavior).
2.  **Concurrency**: Instance A and Instance B of the webhook handler start processing at the same millisecond.
3.  **Race**:
    *   Both instances call `prisma.emailEvent.findFirst` and find no existing record.
    *   Both instances succeed in `prisma.emailEvent.create` because there is no unique constraint.
    *   Both instances proceed to call `updateRecipientStatus`.
    *   If the event is the first of its kind (e.g., `SENT`), both instances might increment the `BroadcastEmail.sentCount`.

## Risk Assessment

*   **Evidence Class**: `REPOSITORY_EVIDENCE`.
*   **Classification**: `HIGH_CONFIDENCE_CODE_FINDING`.
*   **Data Integrity**: **Medium Risk**. Duplicate event logs pollute the audit trail, and aggregate counts in `BroadcastEmail` (used for admin reporting) may become inaccurate.
*   **Launch Impact**: **MEDIUM**. While not a direct blocker for core patron access, it compromises the reliability of the email communication audit trail and reporting, which is critical for launch-ready excellence.

## Recommendation

**Status: IMPLEMENTATION_REQUIRED**

The ticket should be moved to `READY_FOR_BUILDER` with the following implementation requirements:

1.  **Harden Schema**: Add a unique constraint to `EmailEvent`. Ideally, store and use the `svix-id` as a unique provider-side event identifier.
2.  **Atomic Locking**: Adopt the `StripeEventLockService` pattern (acquire-lock-first) or use a database-level `upsert` with a catch for unique constraint violations (P2002) to ensure atomic deduplication.
3.  **Atomic Increments**: Ensure that aggregate counter increments in `BroadcastEmail` are conditional and atomic, ideally tied to the success of the unique event ingestion.
4.  **Audit Persistence**: Ensure the `eventId` (Svix ID) is correctly persisted in the `EmailEvent` table.
