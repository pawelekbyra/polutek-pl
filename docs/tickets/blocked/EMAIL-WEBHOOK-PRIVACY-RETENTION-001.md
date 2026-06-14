# EMAIL-WEBHOOK-PRIVACY-RETENTION-001 — Minimize EmailEvent data and define retention

Status: **PARTIAL**
Ticket ID: EMAIL-WEBHOOK-PRIVACY-RETENTION-001
Launch impact: **MEDIUM_TO_HIGH**

## Purpose
Minimize PII in the `EmailEvent` ledger and define a clear retention and cleanup policy for webhook payloads.

## Target Behavior
- Determine if `EmailEvent.email` is necessary (it is redundant if IDs are used).
- Sanitize `payload` to remove PII if possible.
- Implement retention period (e.g., 30 days) and cleanup job.

## Acceptance Criteria
- Ledger contains minimum necessary data.
- No raw PII in success metadata unless required.
- Retention policy documented.
