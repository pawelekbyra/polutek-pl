# EMAIL-WEBHOOK-ERROR-SAFETY-001 — Prevent webhook error, secret and PII disclosure

Status: **CONFIRMED_GAP**
Ticket ID: EMAIL-WEBHOOK-ERROR-SAFETY-001
Launch impact: **HIGH**

## Purpose
Ensure that webhook responses and persisted error messages do not leak internal details, SQL constraints, URLs, tokens, or PII.

## Verified Current Behavior
`EmailEvent.error` may store raw exception messages. The route may return `result.error.message` which might contain internal details if not carefully mapped.

## Target Behavior
- Use stable, generic public error messages.
- Persist sanitized error codes or messages to `EmailEvent.error`.
- Ensure `acquireLock` is wrapped in a controlled error boundary.
- Redact secrets/PII before logging or persisting.

## Acceptance Criteria
- No SQL or internal stack traces in public responses.
- No tokens or PII in `EmailEvent.error`.
- Unit tests with synthetic secrets prove redaction.
