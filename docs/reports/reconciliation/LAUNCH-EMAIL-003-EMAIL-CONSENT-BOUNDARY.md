# LAUNCH-EMAIL-003 — Email Consent Boundary Runtime Hardening

## Ticket

LAUNCH-EMAIL-003 — Harden email consent boundary and Resend Audience runtime behavior.

Canonical ticket: `docs/tickets/ready/LAUNCH-EMAIL-003-email-consent-boundary-runtime-hardening.md`.

## Baseline

- Baseline HEAD before edits: `45f9319bdc1010be669b56459ea55e7774de8119`.
- Baseline verification: `COMMIT_ANCESTRY`.
- Actual branch: `work`.
- Working tree before edits: clean.

## Changed files

- `app/api/subscriptions/route.ts`
- `lib/modules/email/application/send-admin-broadcast-email.use-case.ts`
- `lib/modules/email/domain/email.policy.ts`
- `lib/modules/subscriptions/application/subscribe.use-case.ts`
- `lib/modules/subscriptions/application/unsubscribe.use-case.ts`
- `lib/modules/subscriptions/domain/email-address.ts`
- `lib/modules/subscriptions/domain/provider-sync-status.ts`
- `lib/modules/subscriptions/index.ts`
- `lib/modules/subscriptions/infrastructure/email-preference.repository.ts`
- `lib/modules/subscriptions/infrastructure/resend-audience.gateway.ts`
- `lib/services/email.service.ts`
- `tests/unit/modules/email/email-service-broadcast-consent-boundary.test.ts`
- `tests/unit/modules/email/send-admin-broadcast-email.test.ts`
- `tests/unit/modules/email/system-email-consent-boundary.test.ts`
- `tests/unit/modules/subscriptions/resend-audience.gateway.test.ts`
- `tests/unit/modules/subscriptions/subscriptions-route-boundary.test.ts`
- `tests/unit/modules/subscriptions/subscriptions.use-cases.test.ts`
- `tests/unit/modules/subscriptions/email-preference.repository.test.ts`
- `docs/reports/reconciliation/LAUNCH-EMAIL-003-EMAIL-CONSENT-BOUNDARY.md`

## Current hazards found

| Area | Local finding |
| --- | --- |
| System/transactional send paths | `sendTemplateEmail` sent Resend email and then auto-created a Resend Audience contact with `unsubscribed: false`; wrappers included welcome, account-deleted, password-changed, donation thank-you and become-patron. |
| Content-notification subscribe paths | `POST /api/subscriptions` created an active `Subscription` only; provider Audience sync and legacy preference update were not explicit. |
| Content-notification unsubscribe paths | `DELETE /api/subscriptions` deleted local `Subscription`; provider unsubscribe and legacy negative preference update were not explicit. |
| Resend Audience mutation paths | Audience mutation existed in generic system sender; Resend webhook writes opt-out preference for provider unsubscribe events. |
| Broadcast recipient-selection paths | Admin broadcast use case used `EmailPolicy`; legacy service broadcast used pending `BroadcastEmailRecipient` rows. |
| EmailPreference reads/writes | Broadcast used `marketingEmails`; prior policy defaulted missing preference to opted-in. Resend webhook can write opt-out. |
| Subscription reads/writes | Subscription module reads/writes explicit local channel notification subscription records. |
| Bounce/complaint/suppression reads/writes | Broadcast recipient delivery status has bounced/complained fields; no separate suppression source exists in schema. |
| PatronGrant reachable from these flows | No subscription-module PatronGrant dependency was found; payment fulfillment can send patron email but system email must not create consent. |

## Implemented behavior

- Generic system/template sender now renders and sends only; it no longer mutates Resend Audience contacts or local consent.
- Explicit subscribe records local `Subscription`, updates legacy content-notification preference to opted-in, then syncs Resend Audience outside the DB transaction.
- Explicit unsubscribe removes local `Subscription`, records legacy content-notification opt-out, then syncs Resend Audience unsubscribe outside the DB transaction.
- Provider sync status is explicit: `SYNCED`, `NOT_CONFIGURED`, or `FAILED`.
- Broadcast/content sends require active local `Subscription` and no explicit negative legacy preference override.
- Recipients without `userId` or active local subscription are skipped with `NO_VERIFIABLE_CONTENT_OPT_IN`.

## Consent source of truth

Active `Subscription` for the authenticated user and main channel is the positive local content-notification opt-in. Missing `Subscription` means `NOT OPTED IN`. `EmailPreference.marketingEmails === false` is a legacy negative override. `EmailPreference.marketingEmails === true`, missing `EmailPreference`, Resend Audience state, payment state, PatronGrant state, `User.isPatron`, and Clerk metadata are not positive consent truth.

## Resend Audience behavior

- `syncExplicitSubscribe(email)` is only called from explicit subscribe after local state is committed.
- `syncExplicitUnsubscribe(email)` is only called from explicit unsubscribe after local opt-out state is committed.
- Missing `RESEND_AUDIENCE_ID` returns `NOT_CONFIGURED` and does not fail local consent changes.
- Provider failure returns `FAILED` and does not roll back or restore local consent.
- The gateway logs only controlled operation/status context and masked email.

## Subscribe failure semantics

- Local DB failure prevents provider subscribe sync.
- Provider subscribe failure leaves local `Subscription` intact and returns `providerSyncStatus: FAILED`.
- A later explicit subscribe can retry provider sync without duplicating `Subscription`.

## Unsubscribe failure semantics

- Local opt-out is written before provider sync.
- Provider unsubscribe failure leaves the user locally unsubscribed and returns `providerSyncStatus: FAILED`.
- Repeated DELETE remains domain-idempotent and can retry provider unsubscribe.

## Broadcast eligibility

Eligible content broadcast recipient requires:

1. verified `userId` on recipient;
2. active `Subscription` for that user and the main channel;
3. no `EmailPreference.marketingEmails === false` override.

Missing userId, missing main-channel Subscription, or explicit legacy opt-out is skipped. Broadcast send does not create Subscription and does not write provider `unsubscribed: false`.

## Tests executed

- `npx vitest run tests/unit/modules/email/system-email-consent-boundary.test.ts tests/unit/modules/email/email-service-broadcast-consent-boundary.test.ts tests/unit/modules/email/send-admin-broadcast-email.test.ts tests/unit/modules/subscriptions/subscriptions.use-cases.test.ts tests/unit/modules/subscriptions/subscriptions-route-boundary.test.ts tests/unit/modules/subscriptions/resend-audience.gateway.test.ts`
- `git diff --check`
- `node scripts/check-control-plane-docs.mjs`
- `npm run quality:architecture-boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm test -- --run`

## Validation results

- Focused tests: PASS — 6 files, 35 tests.
- Diff whitespace check: PASS.
- Control-plane guard: PASS.
- Architecture boundaries: PASS.
- Typecheck: PASS.
- Lint: PASS with pre-existing warning in `app/admin/videos/page.tsx` about `migrationStatusFilter`.
- Full test suite: PASS — 134 files, 666 tests.

## Known gaps

- FULL_SUPPRESSION_IMPLEMENTATION_PENDING: current schema does not separate ordinary opt-out from complaint/bounce suppression as a dedicated suppression model.
- Signed public unsubscribe, public landing page, bounce/complaint webhook redesign, outbox/retry architecture, legal copy and production evidence remain out of scope.
- Production/operator verification was not added by this runtime ticket.

## Suppression status

Existing bounce/complaint broadcast recipient status fields are preserved. This ticket does not add suppression schema, does not clear complaint state, and does not implement complaint re-subscribe policy.

## Non-goals preserved

- No signed public unsubscribe.
- No unsubscribe without login.
- No full bounce/complaint webhook redesign.
- No new suppression schema or migration.
- No package changes.
- No Prisma schema changes.
- No global roadmap/queue/status changes.
- No PatronGrant mutation.

## Runtime evidence classification

Implementation evidence: local/automated only.

## Production evidence classification

Production/operator evidence: not added.

Legal approval: not added.

X7 certification: not added.

## Launch status

Public launch: NO_GO.

## Recommended ticket status

MERGE, subject to final validation passing in the PR handoff.

## Corrective pass after PR #893

- Baseline merge commit: `8a98179fdcb30ec521e565743ac5bac45a30b606`.
- Verified defects:
  1. Missing `RESEND_AUDIENCE_ID` or `RESEND_API_KEY` could throw exceptions during subscribe/unsubscribe flows.
  2. User email changes caused unique constraint violations in `EmailPreference` table, blocking local unsubscribe.
  3. `GET /api/subscriptions` required a trusted email claim and triggered `GetOrCreateUserUseCase`, causing unnecessary side effects and potential 400 errors for authenticated actors without verified emails.
  4. Resend Audience gateway performed blind "get -> create -> update" sequences on errors, potentially masking authentication or network failures.

### Deterministic provider-error hardening
- Added `isNotFoundError` and `isConflictError` helpers using SDK status codes (404, 409) and error names.
- Explicit Subscribe: Only attempts `create` if `get` returns 404. Retries `update` only if `create` returns 409.
- Explicit Unsubscribe: Never creates contacts. Treats 404 as successful sync.
- Network/Auth/5xx errors now return `FAILED` immediately without retries that could create false states.

### Gateway configuration behavior
- Lazy client initialization: `Resend` client is created only when needed.
- `RESEND_AUDIENCE_ID` missing -> `NOT_CONFIGURED`.
- `RESEND_API_KEY` missing -> `FAILED` (with controlled warning).
- No provider exceptions escape the gateway; all SDK calls are wrapped in try/catch returning `FAILED`.

### EmailPreference identity-resolution algorithm
- Primary lookup by `userId`.
- Email identity migration: if email changed but is taken by another user, the user's record is updated (consent change) but the foreign email is not hijacked.
- Secondary lookup by `email` for legacy records without `userId`.
- Foreign records (different `userId`) are never mutated.
- Unsubscribe always succeeds locally even if an email conflict exists.

### GET behavior
- Before: Required trusted email, synced user profile, could return 400 or 401.
- After: Requires authenticated actor only, read-only, no user sync, no email required.

### POST/DELETE trusted-email behavior
- Still requires trusted email from session claims.
- Performs user profile sync before mutation.
- Verified no email is read from request body.

### Changed files
- `app/api/subscriptions/route.ts`
- `lib/modules/subscriptions/infrastructure/email-preference.repository.ts`
- `lib/modules/subscriptions/infrastructure/resend-audience.gateway.ts`
- `tests/unit/modules/subscriptions/resend-audience.gateway.test.ts`
- `tests/unit/modules/subscriptions/subscriptions-route-boundary.test.ts`
- `tests/unit/modules/subscriptions/subscriptions.use-cases.test.ts`
- `tests/unit/modules/subscriptions/email-preference.repository.test.ts`

### Test results
- Focused tests: PASS (31 tests across 4 files).
- Architecture check: PASS.
- Typecheck: PASS.
- Full suite: PASS.

### Evidence & Recommendation
Implementation evidence: local/automated only.
Production/operator evidence: not added.
Professional legal approval: not added.
FULL_SUPPRESSION_IMPLEMENTATION_PENDING.
Public launch: NO_GO.

Recommendation: MERGE.

## Final Acceptance Patch

- Baseline: `f7f352fa2ef133bc9411e6df3f5e64f0db0e99a8`.
- Hardened Subscriptions API Route tests: replaced static source scans with actual handler behavior tests (GET/POST/DELETE) using Vitest and mocks.
- Hardened `EmailPreferenceRepository`: added `P2002` (unique constraint) catch blocks to `create` and `update` operations to handle potential race conditions during concurrent consent updates or email migrations.
- Verified that `GET /api/subscriptions` remains read-only and does not require email claims even at the handler level.

### Test results
- Subscriptions route behavior tests: PASS (7 tests).
- EmailPreferenceRepository race condition tests: PASS (9 tests).
- Focused tests suite: PASS.
- Architecture check: PASS.
- Typecheck: PASS.
- Full suite: PASS.

### Evidence & Recommendation
Implementation evidence: local/automated only.
Production/operator evidence: not added.
Professional legal approval: not added.
FULL_SUPPRESSION_IMPLEMENTATION_PENDING.
Public launch: NO_GO.

Recommendation: MERGE.

## LAUNCH-EMAIL-003 Corrective Integration

- Old candidate SHA: `3911de91e34e2b4cff6cffd8bc0583c2b9e0be45`.
- Final rebased SHA: `PENDING`.
- Current main baseline: `70147ebfc784014d4e604b1b467b7d1f4c43a803`.

### Defect Resolution
The previous candidate ignored the result of `recordExplicitContentOptIn` in `SubscribeUseCase`. If a foreign email conflict occurred (`recorded: false`), the use case would still create a local `Subscription`, increment subscriber count, and sync with the provider.

### Final Behavioral Logic

#### Explicit Opt-in (Subscribe)
- When `EmailPreferenceRepository` returns `recorded: false`, the use case now throws an `AppError` with HTTP 409 and code `EMAIL_PREFERENCE_IDENTITY_CONFLICT`.
- This ensures the database transaction is aborted.
- No `Subscription` is created, and no subscriber count is incremented.
- Resend Audience sync is skipped.
- Error message is neutral and does not leak identities.

#### Explicit Opt-out (Unsubscribe)
- Opt-out remains fail-safe.
- When `recorded: false` with `FOREIGN_EMAIL_CONFLICT` occurs, the use case still removes the actor's local `Subscription`, decrements count, and calls provider unsubscribe.
- A structured warning `[SUBSCRIPTION_IDENTITY_CONFLICT]` is emitted to logs without sensitive data.

#### Repository Hardening
- Implemented `isPrismaUniqueConstraintError` as a type-safe guard (no `any`).
- Shared `upsertPreference` logic handles complex lookup/update/create sequences with race-condition retries.
- Non-P2002 database errors are explicitly rethrown.

### Test Evidence
- `email-preference.repository.test.ts`: 12 tests covering identity resolution, conflicts, race conditions (P2002), and non-P2002 error propagation.
- `subscriptions.use-cases.test.ts`: 9 tests proving transactional integrity on opt-in conflict and fail-safe behavior on opt-out conflict.
- `subscriptions-route-boundary.test.ts`: 9 tests verifying HTTP 409 mapping and route-level security invariants.

### Production Evidence
- None added. Implementation verified via automated tests only.

### Status
- Public launch: `NO_GO`.
- Builder recommendation: `READY_FOR_INDEPENDENT_REVIEW`.
