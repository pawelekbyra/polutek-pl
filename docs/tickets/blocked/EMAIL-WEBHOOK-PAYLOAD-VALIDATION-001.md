# EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001 — Add event-specific payload validation

Status: **CONFIRMED_GAP**
Ticket ID: EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001
Launch impact: **HIGH**

## Purpose
Add strict schema validation for each supported Resend event type to prevent processing malformed payloads or missing critical IDs.

## Verified Current Behavior
Payload validation is generic. Critical fields like `email_id` are checked in some places but may lead to silent success (marking as `PROCESSED`) even if no business logic was executed due to missing data.

## Target Behavior
- Per-event schema validation.
- Required `email_id` for status updates.
- Required recipient email for `unsubscribe`.
- Return deterministic 400 for malformed supported events.

## Acceptance Criteria
- Malformed supported events are NOT marked as `PROCESSED`.
- All required fields for an event type are verified before processing.
