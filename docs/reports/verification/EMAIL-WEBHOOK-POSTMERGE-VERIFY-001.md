# EMAIL-WEBHOOK-POSTMERGE-VERIFY-001 — Post-merge verification report

Ticket ID: `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`
Role: Reviewer / Certifier
Repository: `pawelekbyra/polutek-pl`
Branch checked: `verify/email-webhook-postmerge-001`
Public launch: `NO_GO`

## Final verdict

`FIX_REQUIRED`

The PR #905 implementation added a real idempotency ledger and unit-level proof for duplicate, in-flight, failed-event, and recipient-status concurrency behavior. However, this independent verification cannot certify the ticket as `PASS` because:

1. The Resend route still accepts the legacy `x-resend-webhook-secret` path whenever the header equals `RESEND_WEBHOOK_SECRET`, including production when an event ID is present. That path bypasses Svix signature verification.
2. The required PostgreSQL fresh/upgraded migration and real concurrent-processing evidence could not be produced in this workspace because no PostgreSQL server/client or `DATABASE_URL` was available.
3. `npm run quality:strict-escapes` currently fails repository-wide, including several files in the email idempotency implementation surface.
4. `npm run env:validate:prod` fails in this local workspace due missing production environment variables, including `ADMIN_CLERK_USER_IDS` despite PR #910 adding the CI fixture.
5. `npm audit --audit-level=high` is blocked by registry `403 Forbidden` in this environment, so no local security-audit pass evidence exists.

## Checked baseline and merge context

| Item | Evidence | Result |
| --- | --- | --- |
| Actual checked `HEAD` | `7920072ebf29cca5f0cb122ea59d75cc02ef7a9f` | PASS |
| Actual branch | `verify/email-webhook-postmerge-001` | PASS |
| Remote `origin/main` checkout | `git fetch origin main` failed: `origin` is not configured in this isolated workspace. Work continued from the current checked repository state per portable workspace baseline rules. | BLOCKED / ENVIRONMENT |
| PR #905 implementation merge SHA | `36b57dec5c763ca29ff708c836dae0601125c49d` is an ancestor of checked `HEAD` (`git merge-base --is-ancestor ... HEAD` exit `0`). | PASS |
| PR #910 CI fixture merge SHA | `49695941171a4de47a22b036a0b5255c8bbd16be` is an ancestor of checked `HEAD` (`git merge-base --is-ancestor ... HEAD` exit `0`). | PASS |
| Current ticket source | `docs/tickets/ready/README.md` points to `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`. | PASS |
| Control-plane precheck | `docs/governance/BOLEK-OPERATING-MODEL.md` inspected; mandatory post-merge reconciliation and portable baseline rules observed. | PASS |

## Environment and database setup

| Capability | Observed state | Result |
| --- | --- | --- |
| PostgreSQL server via Docker | `docker --version` returned `docker: command not found`. | BLOCKED / ENVIRONMENT |
| PostgreSQL client tools | `psql --version` and `pg_isready` returned `command not found`. | BLOCKED / ENVIRONMENT |
| Database URL | No `DATABASE_URL` / `DATABASE_URL_UNPOOLED` was present in the environment. | BLOCKED / ENVIRONMENT |
| Prisma client generation | `npx prisma generate` succeeded without a database connection. | PASS |
| Real DB integration suite without opt-in | `npx vitest run tests/integration/email-event-idempotency.test.ts` skipped both tests because `RUN_INTEGRATION_TESTS` was not `true`. | BLOCKED / NO DB EVIDENCE |
| Real DB integration suite with opt-in | `RUN_INTEGRATION_TESTS=true npx vitest run tests/integration/email-event-idempotency.test.ts` failed before assertions because Prisma could not find `DATABASE_URL`. | BLOCKED / ENVIRONMENT |

## Implementation design review

### Intended design match

| Requirement | Evidence | Result |
| --- | --- | --- |
| Durable provider event ledger | `EmailEvent` has `providerEventId`, `status`, `error`, `processedAt`, and `updatedAt`; `providerEventId` is unique. | PASS |
| Atomic first-writer acquisition | `EmailEventLockService.acquireLock` creates an `EmailEvent` row with status `PROCESSING`; unique-constraint `P2002` drives duplicate/concurrency handling. | PASS |
| Duplicate replay after success | Existing `PROCESSED` events return `ALREADY_PROCESSED`; use case returns `{ duplicate: true }` and does not re-run business logic. | PASS |
| In-flight duplicate/concurrency | Existing fresh `PROCESSING` events return `CONFLICT`; use case maps that to a 503 `LOCK_CONFLICT`. | PASS |
| Failed-event retry | Existing `FAILED` events are reset to `PROCESSING` with `error: null`. | PASS |
| Stale-processing takeover | Existing `PROCESSING` rows older than 10 minutes are reset to `PROCESSING` and acquired. | PASS by code review; not proven against a real PostgreSQL database in this environment. |
| Event type fencing | If the same `providerEventId` exists with a different `type`, lock acquisition returns `CONFLICT`. | PASS |
| Minimal payload storage for normal events | The use case passes a minimized payload containing `type`, `created_at`, and `email_id` to `EmailEventLockService`. | PASS |
| Release on success/failure | Use case calls `releaseWithSuccess` after business logic and `releaseWithFailure` on processing error. | PASS |

### Important limitation

The migration adds `providerEventId` as a nullable unique column. PostgreSQL permits multiple `NULL` values in a unique index, so historical events without `providerEventId` can coexist. New strict idempotency depends on the use case requiring `eventId`; that use-case requirement exists. Existing historical rows are not backfilled, which is acceptable for forward idempotency but leaves historical rows without provider replay keys.

## Migration behavior evidence

### Fresh PostgreSQL database

`BLOCKED / ENVIRONMENT`

No fresh PostgreSQL database could be created or migrated in this workspace because Docker and PostgreSQL tools are unavailable and no `DATABASE_URL` is configured. Static migration review found:

- Baseline migration creates `EmailEvent`.
- PR #905 migration `20260614000000_add_email_event_idempotency` adds `error`, `processedAt`, `providerEventId`, `status`, and `updatedAt`, then creates unique index `EmailEvent_providerEventId_key`.

This is static evidence only; it is not fresh-database execution evidence.

### Existing/upgraded PostgreSQL database

`BLOCKED / ENVIRONMENT`

No existing PostgreSQL database could be migrated in this workspace. Static migration review found one upgrade risk:

- The migration creates a non-concurrent unique index on nullable `providerEventId`. Because the column is newly added and null for existing rows, the unique index should not fail from duplicate existing non-null values; however, this was not executed.
- The migration adds non-null `status` and `updatedAt` with defaults, which should populate existing rows in PostgreSQL, but this was not executed.

## Concurrent processing evidence

| Evidence type | Result | Notes |
| --- | --- | --- |
| Unit tests for lock outcomes | PASS | `email-event-lock.repository.test.ts` proves create, `PROCESSING` conflict, `PROCESSED` duplicate, mismatched type conflict, and `FAILED` reacquire with mocks. |
| Unit tests for use-case idempotency | PASS | `idempotency-hardening.test.ts` proves duplicate short-circuit, conflict short-circuit, success release, failure release, and missing `eventId` rejection. |
| Unit tests for recipient status concurrency retries | PASS | Included in the five-file relevant unit test command; command passed. |
| Real PostgreSQL concurrent/unique behavior | BLOCKED / ENVIRONMENT | Integration suite was skipped without `RUN_INTEGRATION_TESTS=true` and failed with `DATABASE_URL` missing when opt-in was enabled. |

## Ownership, fencing, and stale-takeover evidence

| Scenario | Evidence | Result |
| --- | --- | --- |
| Ownership/fencing by provider event ID | `providerEventId` is the lock key and is persisted as unique. | PASS |
| Event type mismatch under same event ID | Mocked repository unit test returns `CONFLICT` when existing row type differs. | PASS |
| Fresh in-flight owner | Fresh `PROCESSING` duplicate returns `CONFLICT`, preventing two handlers from running business logic for the same event. | PASS |
| Stale takeover | Code resets `PROCESSING` rows older than `EMAIL_STALE_MS = 10 * 60_000`; no dedicated real DB or unit assertion for the timestamp predicate was run beyond static inspection. | PARTIAL PASS / NEEDS DB EVIDENCE |
| Failed-event takeover | Unit test proves `FAILED` rows can be reacquired. | PASS |

## Replayed and duplicate webhook handling

| Scenario | Evidence | Result |
| --- | --- | --- |
| Replayed after processed | `ALREADY_PROCESSED` path returns success with `duplicate: true` and no business logic. | PASS |
| Concurrent duplicate while processing | `CONFLICT` path returns 503 and no business logic. | PASS |
| Duplicate inbound email content | `handleInboundEmail` ignores `P2002` on `InboundEmail.resendId` and releases success. | PASS |
| Duplicate legacy route request with same provider event ID | Depends on `payload.eventId`; production legacy requests without `svix-id` are rejected, but legacy requests with a `svix-id` header and matching secret bypass Svix verification. | FAIL / SECURITY |

## Route security and signature requirements

| Scenario | Evidence | Result |
| --- | --- | --- |
| Production missing configured secret | Route returns 500 if `NODE_ENV=production` and `RESEND_WEBHOOK_SECRET` is missing. | PASS |
| Valid Svix headers | Route verifies raw body via `svix.Webhook.verify` and assigns `payload.eventId = svixId`. | PASS |
| Invalid Svix signature | Unit route test verifies 401. | PASS |
| Missing signature | Route returns 401 unless legacy secret path succeeds. | PARTIAL |
| Legacy secret path | Route accepts `x-resend-webhook-secret` when it equals `RESEND_WEBHOOK_SECRET`; this branch is not restricted to non-production. Production only rejects if no resulting `eventId`. A forged request with a matching legacy secret plus `svix-id` but without valid Svix signature can reach `handleResendWebhook`. | FAIL |
| Malformed legacy JSON | `JSON.parse(rawBody)` is outside a try/catch; malformed JSON would throw through the route instead of returning a controlled 400/401. | FAIL |

## Negative behavior for missing, invalid, or malformed signatures

| Negative case | Observed / inferred behavior | Result |
| --- | --- | --- |
| Invalid Svix signature | Unit test passed; route returns 401 and does not call the handler. | PASS |
| Missing all auth headers | Static route review: route returns 401. | PASS |
| Legacy secret with no event ID in production | Unit test passed; route returns 400. | PASS |
| Legacy secret with event ID in production | Static route review: accepted without Svix signature verification. | FAIL |
| Malformed JSON on legacy path | Static route review: uncaught `JSON.parse` exception. | FAIL |

## PII and secret redaction evidence

| Surface | Evidence | Result |
| --- | --- | --- |
| Stored `EmailEvent.payload` | Use case minimizes payload to `type`, `created_at`, and `email_id`; it no longer stores full recipient/body payload for normal events. | PASS |
| Stored `EmailEvent.email` | PR #905 path calls `releaseWithSuccess(providerEventId, { resendEmailId })`, not `email`; no email is stored by this path. | PASS |
| Logs in lock service | Logs include `providerEventId` and event type. Provider event IDs are operational identifiers, not raw secrets, but they can be sensitive correlation IDs. | PARTIAL |
| Logs in handler | Processing log includes `email_id` and `event_id`; missing-event log includes type. No raw recipient address is logged by the idempotency path. | PARTIAL |
| Route signature errors | Route logs the Svix verification error object. No raw secret is directly logged in the code; actual Svix error contents were not inspected. | PARTIAL |
| Error responses | Handler failure response returns `result.error.message` and `code`. Business/database error messages may be exposed to the webhook caller. | RISK |
| Existing docs conflict | Older readiness report states Resend webhook stored full payload and emails before this hardening. Current code improves this, but historical rows may still contain older payloads until retention/backfill is handled. | RISK |

## Commands executed

| Command | Result | Exact outcome summary |
| --- | --- | --- |
| `git fetch origin main && git checkout -B verify/email-webhook-postmerge-001 origin/main` | BLOCKED / ENVIRONMENT | Failed: `origin` is not configured. |
| `git checkout -B verify/email-webhook-postmerge-001` | PASS | Created/reset local branch from checked `HEAD`. |
| `git merge-base --is-ancestor 36b57dec5c763ca29ff708c836dae0601125c49d HEAD` | PASS | Exit `0`. |
| `git merge-base --is-ancestor 49695941171a4de47a22b036a0b5255c8bbd16be HEAD` | PASS | Exit `0`. |
| `docker --version` | BLOCKED / ENVIRONMENT | `docker: command not found`. |
| `psql --version` | BLOCKED / ENVIRONMENT | `psql: command not found`. |
| `pg_isready` | BLOCKED / ENVIRONMENT | `pg_isready: command not found`. |
| `npm run env:validate:prod` | FAIL / ENVIRONMENT | Missing required production env including `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_CLERK_USER_IDS`, and others. |
| `npx prisma validate` | FAIL / ENVIRONMENT | `P1012`, missing `DATABASE_URL_UNPOOLED`. |
| `npx prisma generate` | PASS | Prisma Client v6.19.3 generated successfully. |
| `npm run quality:strict-escapes` | FAIL / REPOSITORY-WIDE | Strict TypeScript escape hatch check listed many explicit `any` usages; includes email webhook files and many unrelated files. |
| `npm audit --audit-level=high` | BLOCKED / ENVIRONMENT | Registry audit endpoint returned `403 Forbidden`. |
| `npx vitest run tests/unit/modules/email/idempotency-hardening.test.ts tests/unit/modules/email/email-event-lock.repository.test.ts tests/unit/modules/email/concurrency-retries.test.ts tests/unit/modules/email/handle-resend-webhook.test.ts tests/unit/api/resend/resend-webhook-route.test.ts` | PASS | 5 test files passed; 28 tests passed. |
| `npx vitest run tests/integration/email-event-idempotency.test.ts` | BLOCKED / NO DB EVIDENCE | 1 file skipped; 2 tests skipped because integration opt-in was absent. |
| `RUN_INTEGRATION_TESTS=true npx vitest run tests/integration/email-event-idempotency.test.ts` | BLOCKED / ENVIRONMENT | 1 file failed; 2 tests failed before assertions due missing `DATABASE_URL`. |
| `git diff --check` | PASS | Exit `0` before report edits. |
| `git diff --name-only` | PASS | Exit `0` before report edits. |
| `node scripts/check-control-plane-docs.mjs` | PASS | `CONTROL_PLANE_CHECK: PASS`. |

## Known failures classification

| Failure | Classification | Why |
| --- | --- | --- |
| Legacy secret route bypass | Implementation-specific | It is in `app/api/webhooks/resend/route.ts` and directly affects the PR #905 security/idempotency boundary. |
| Malformed legacy JSON uncaught | Implementation-specific | It is in `app/api/webhooks/resend/route.ts`. |
| Missing PostgreSQL migration/concurrency evidence | Environmental for this workspace; verification gap for the ticket | No Docker, PostgreSQL client, or DB env exists here. |
| `env:validate:prod` fail | Environmental/local config | Local workspace lacks required production env. PR #910 fixture change is CI-specific and cannot be proven by this local command. |
| `npx prisma validate` fail | Environmental/local config | Missing `DATABASE_URL_UNPOOLED`; schema generation still works. |
| `quality:strict-escapes` fail | Repository-wide, with implementation-surface entries | Many existing explicit `any` usages across app/lib, including email webhook use-case lines. |
| `npm audit` fail | Environmental/network/registry | Registry returned `403 Forbidden`, not an advisory finding. |

## Remaining risks and follow-ups

1. Remove or strictly non-production-gate the Resend legacy secret webhook path; production should require Svix signature verification only.
2. Add route tests for missing Svix headers, legacy secret with `svix-id` in production, and malformed JSON on the legacy path.
3. Run fresh PostgreSQL `prisma migrate deploy` from an empty database and record the actual output.
4. Run upgraded PostgreSQL migration from a database at the pre-PR #905 schema and record the actual output.
5. Run the integration idempotency suite against PostgreSQL with `RUN_INTEGRATION_TESTS=true` and a real `DATABASE_URL`.
6. Add real concurrent lock-acquisition coverage that proves exactly one processor wins and the duplicate path does not execute business logic.
7. Decide whether provider event IDs and Resend email IDs in logs require hashing/redaction under the launch privacy standard.
8. Resolve repository-wide strict escape failures or narrow the quality gate's accepted baseline before using it as certification evidence.
9. Obtain CI output after PR #910 for `env:validate:prod`; this local run cannot prove the CI fixture behavior.

## Scope confirmation

This verification ticket made documentation/report-only changes. No runtime, schema, migration, package, workflow, dependency, guard, app, lib, component, test, or script files were intentionally modified.
