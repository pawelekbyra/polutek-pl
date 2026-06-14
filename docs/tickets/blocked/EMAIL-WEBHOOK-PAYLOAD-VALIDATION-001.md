# EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001 — Add event-specific payload validation and prevent silent success

* **Status**: CONFIRMED_GAP
* **Ticket ID**: EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001
* **Role**: Builder
* **Launch impact**: HIGH

## Purpose
Add strict schema validation for each supported Resend event type to prevent processing malformed payloads and avoid marking malformed events as `PROCESSED`.

## Verified current behavior
Payload validation is generic. Critical fields like `email_id` are checked with `if (resendEmailId)` but missing data may just log a warning and let the lock service mark the event as `PROCESSED` without business impact.

## Root cause
Absence of a per-event validation contract.

## Risk
System claims to have processed an event (idempotency lock set) when it actually ignored it due to missing fields, preventing future corrected retries.

## Dependencies
- `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`

## Owner decisions required
- Classification of malformed data: 400 (Permanent) vs 500 (Retry).

## Allowed paths
- `lib/modules/email/application/handle-resend-webhook.use-case.ts`
- `lib/modules/email/domain/webhook-schemas.ts` (new)
- `tests/unit/modules/email/handle-resend-webhook.test.ts`

## Disallowed paths
- `lib/prisma/**`

## Target behavior
Each supported event type has a mandatory schema. If validation fails, the use case returns a `fail()` result, preventing the lock service from marking it as `PROCESSED` (unless failure is terminal).

## Detailed acceptance criteria
1. `email.sent`, `email.delivered`, etc. have required fields (e.g. `data.email_id`).
2. `email.unsubscribed` requires recipient email.
3. Malformed supported event returns deterministic 400.
4. Payload timestamp `created_at` is read from `input.data.created_at` (correct path).
5. Unsupported event types are ignored gracefully (200 OK, `ignored: true`) without setting an idempotency lock for an ID.

## Required unit tests
- Malformed `email.sent` (missing email_id) -> returns Error, lock NOT processed.
- Correct path check for `created_at`.
- Unsupported event type -> returns success with `ignored: true`.

## Required integration tests
- None.

## Required negative tests
- Null bytes or malformed JSON in payload.

## Migration impact
None.

## Security/privacy impact
Prevents malformed data from corrupting the ledger.

## Observability requirements
- Log warnings for `[ResendWebhook] Validation failed for type X`.

## Rollout/rollback requirements
- Standard deploy.

## Non-goals
- Fixing ownership.

## Required evidence
- Unit tests for each supported event schema.

## Exit state
`IMPLEMENTED_VERIFIED`.
