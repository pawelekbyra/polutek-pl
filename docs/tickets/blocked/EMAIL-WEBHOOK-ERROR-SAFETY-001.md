# EMAIL-WEBHOOK-ERROR-SAFETY-001 — Prevent webhook error, secret and PII disclosure

* **Status**: CONFIRMED_GAP
* **Ticket ID**: EMAIL-WEBHOOK-ERROR-SAFETY-001
* **Role**: Builder
* **Launch impact**: HIGH

## Purpose
Ensure that webhook responses and persisted error messages do not leak internal details, SQL constraints, URLs, tokens, or PII.

## Verified current behavior
`EmailEvent.error` may store raw exception messages from Prisma or external providers. The route may return `result.error.message` which might contain internal details.

## Root cause
Missing error mapping/redaction layer before persistence and response.

## Risk
Leakage of database schema details (via P2002/P2025 errors), environment variables, or user PII in public responses or logs.

## Dependencies
- `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`

## Owner decisions required
- Definition of "safe" public error codes.

## Allowed paths
- `lib/modules/email/application/handle-resend-webhook.use-case.ts`
- `lib/modules/email/infrastructure/email-event-lock.service.ts`
- `app/api/webhooks/resend/route.ts`
- `lib/logger.ts` (if new redaction helpers needed)

## Disallowed paths
- `prisma/schema.prisma`

## Target behavior
All public responses return generic messages. Persistence to `EmailEvent.error` uses sanitized error codes or messages. `acquireLock` is wrapped in a controlled boundary.

## Detailed acceptance criteria
1. Public API returns `error: "Internal Server Error"` or equivalent for non-domain errors.
2. `EmailEvent.error` does not contain SQL, constraint names, or PII.
3. Logger redaction applies to all external error objects.
4. `acquireLock` errors (other than P2002) are captured and mapped to safe responses.

## Required unit tests
- Simulate Prisma error and verify generic response.
- Simulate provider error with token in message and verify it's redacted before saving to DB.
- Unit tests with synthetic secrets prove redaction in logs.

## Required integration tests
- None.

## Required negative tests
- Attempt to trigger constraint violation and check public error message.

## Migration impact
None.

## Security/privacy impact
Prevents information disclosure.

## Observability requirements
- Sanitize all log output.

## Rollout/rollback requirements
- Standard deploy.

## Non-goals
- Fixing ownership.
- Defining counter semantics.

## Required evidence
- Unit test coverage for the error mapping logic.

## Exit state
`IMPLEMENTED_VERIFIED`.
