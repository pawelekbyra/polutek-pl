# Security and quality cleanup roadmap — 2026-06-23

This document turns the deeper audit notes into an execution roadmap. It is not meant to be a final vulnerability report. Its purpose is to keep the cleanup ordered, measurable, and safe to execute in small pull requests.

Related work:
- Issue: #1086
- PR: #1087
- PR: #1091
- Branch: `fix/security-audit-priority`

## North star

The target state is a small, boring, auditable VOD product where:

- backend access decisions are based on durable domain state, not UI/cache hints,
- payment and webhook flows are idempotent and covered by regression tests,
- video playback access is explicitly tested for every access tier,
- request payloads are bounded before expensive parsing or validation,
- CSP is intentionally strict and documented,
- legacy compatibility code is either removed or fenced off,
- launch checklists match the actual implementation.

## Current status

### Already covered by #1087

- [x] Comment text has a route-level maximum length.
- [x] Comment request body is size-limited before JSON parsing.
- [x] Resend webhook request body is size-limited before processing.
- [x] Resend legacy non-production secret auth requires explicit opt-in: `RESEND_WEBHOOK_DEV_SECRET_AUTH=true`.
- [x] Production CSP no longer allows eval-style script execution.
- [x] Temporary test file was removed.
- [x] Unit coverage was added for comment payload limits and CSP environment behavior.

### Covered after #1087 by #1091

- [x] Playback access-control regression tests were added in `tests/unit/playback-access-coverage.test.ts`.
- [x] `PatronGrant` source-of-truth guard tests were added in `tests/unit/patron-grant-truth.test.ts`.
- [x] Stripe webhook duplicate/close-arrival/refund/dispute unit coverage was added in `tests/unit/modules/payments/payment-safety-idempotency.test.ts`.
- [x] Patron cache-field usage was audited and documented in `docs/patron/patron-fields-audit.md`.
- [x] Production evidence collection guidance was added in `docs/launch/production-evidence-runbook.md`.

### Still open after #1087 and #1091

- [ ] Full CSP nonce/hash strategy.
- [ ] Architecture/lint tooling that prevents backend authorization from using patron cache fields, beyond the current regression tests.
- [ ] Deprecated patron bridge removal.
- [ ] Type and error-handling cleanup.
- [ ] Integration/E2E test expansion.
- [ ] API route contract inventory and documentation.

## Execution model

Do not turn this into one giant cleanup PR. Split it into focused PRs that can be reviewed and reverted independently.

Recommended remaining PR order:

1. **CSP strictness PR** — complete nonce/hash strategy and document required exceptions.
2. **Patron authorization guard PR** — add architecture/lint guardrails beyond the `PatronGrant` regression tests.
3. **Patron legacy cleanup PR** — remove or fence deprecated compatibility bridges.
4. **Type/error cleanup PR** — remove weak casts and normalize API error serialization.
5. **Operational polish PR** — API route contracts, focused integration/E2E smoke paths, and any follow-up launch checklist refinements.

## Definition of done for the audit cleanup

The audit cleanup is considered complete only when all of these are true:

- [x] Every backend patron access decision is covered by a test proving `PatronGrant` or a domain use case backed by `PatronGrant` is the source of truth.
- [ ] Cache/display fields such as `User.isPatron`, `patronSince`, and `patronSource` cannot be accidentally used for backend authorization without an architecture/lint guard failing.
- [x] Playback access has regression tests for guest, logged-in, active patron, revoked patron, unpublished video, and missing video cases.
- [x] Stripe webhook processing has duplicate event and close-arrival unit tests.
- [x] Resend webhook non-production secret auth is opt-in and tested.
- [x] Critical request bodies covered by #1087 are bounded before JSON parsing.
- [ ] Production CSP is intentionally strict, tested, and documented with a nonce/hash strategy.
- [ ] Deprecated patron compatibility bridges are removed or blocked from new usage.
- [ ] Critical API routes have documented auth, payload, success, and error contracts.
- [ ] CI includes any remaining integration/E2E checks selected for launch confidence.

## Workstream A — access and authorization

Goal: prove that users cannot reach content or capabilities they should not reach.

### A1. Playback access-control tests

Priority: P0

Status: DONE by #1091.

Added tests for:

- [x] Guest + PUBLIC video returns playable/access-ready state.
- [x] Guest + LOGGED_IN video returns login-required state.
- [x] Guest + PATRON video returns patron-required state according to current product policy.
- [x] Logged-in non-patron + PATRON video returns patron-required state.
- [x] Active patron + PATRON video returns playable/access-ready state.
- [x] Revoked/expired patron grant + PATRON video does not unlock access.
- [x] Unpublished/deleted/missing video does not leak playback data.

Acceptance criteria:

- [x] Tests exercise the same service path used by production playback.
- [x] Tests assert both status and absence/presence of sensitive playback data.
- [x] Tests fail if someone later swaps the access outcome back to cache-only patron checks, together with the `PatronGrant` source-of-truth tests.

### A2. PatronGrant source-of-truth enforcement

Priority: P0

Status: PARTIAL. #1091 added the source-of-truth regression tests and cache-field audit documentation. A stronger architecture/lint guard is still open.

Work items:

- [x] Search all reads of `User.isPatron`, `patronSince`, and `patronSource`.
- [x] Classify each read as display/cache sync/admin statistics/backend access.
- [x] Confirm backend authorization uses `PatronGrant` or a domain use case backed by it.
- [ ] Add an architecture check or lint rule that blocks backend access decisions from reading patron cache fields.
- [x] Document allowed exceptions.

Acceptance criteria:

- [x] Backend authorization has regression coverage proving it does not silently rely on patron cache fields.
- [x] Allowed cache-field reads are listed and intentional.
- [ ] A new accidental backend read fails CI or architecture validation.

## Workstream B — webhooks and payments

Goal: make money-related flows deterministic, idempotent, and recoverable.

### B1. Stripe webhook concurrency/idempotency tests

Priority: P0

Status: PARTIAL/DONE for webhook routing and lock/idempotency unit coverage by #1091. Deeper final database-state assertions can be added later if the project wants integration-level guarantees.

Added tests for:

- [x] Duplicate already-processed successful payment event does not double-fulfill.
- [ ] Duplicate successful payment event creates exactly one active patron grant in an integration-level final-state assertion.
- [x] Close-arrival duplicate event returns safely without double fulfillment.
- [x] Lock conflict behavior is tested through failed-event reacquisition and processing.
- [x] Refund and dispute events route to the expected handlers.

Acceptance criteria:

- [x] Tests cover event replay and close-arrival behavior at the webhook/use-case boundary.
- [ ] Tests assert final database state, not only response status and handler calls.
- [ ] Any unresolved crash-window behavior is documented with a remediation task if discovered by deeper integration tests.

### B2. Resend webhook hardening follow-up

Priority: P1

Work items:

- [x] Add a focused test showing non-production secret auth is rejected unless `RESEND_WEBHOOK_DEV_SECRET_AUTH=true`.
- [x] Add a focused test for oversized body rejection.
- [ ] Add a focused test for malformed JSON in the legacy non-production path if that path remains supported.
- [ ] Confirm preview deployments do not enable the opt-in flag by default.

Acceptance criteria:

- [x] Preview/non-production convenience auth is explicit and tested at the route behavior level.
- [ ] Deployment-level evidence confirms preview deployments are safe by default.

## Workstream C — CSP and browser security posture

Goal: move from partial hardening to an intentional strict policy.

### C1. Strict CSP implementation

Priority: P0/P1 depending on launch timing

Work items:

- [ ] Decide nonce vs hash strategy for Next.js runtime scripts and styles.
- [ ] Generate nonce in middleware or equivalent request boundary.
- [ ] Pass nonce through request headers where needed.
- [ ] Confirm Next.js framework scripts, Clerk, Stripe, fonts, media, and embeds still work.
- [ ] Remove remaining broad inline script allowances where practical.
- [ ] Keep only documented style/script exceptions that are truly required.
- [ ] Add production CSP tests that fail when disallowed script execution returns.

Acceptance criteria:

- Production CSP is intentionally strict.
- Required third-party sources are documented.
- Tests prove development-only relaxations do not leak into production.

## Workstream D — legacy and code-quality cleanup

Goal: remove confusing old paths and reduce type/error blind spots.

### D1. Retire deprecated patron compatibility bridges

Priority: P1

Work items:

- [ ] Locate all callers of `grantPatronStatus` and `revokePatronStatus`.
- [ ] Migrate callers to modular patron use cases.
- [ ] Delete the deprecated bridge once unused.
- [ ] Add an architecture guard preventing new imports from the legacy service.

Acceptance criteria:

- There is one obvious patron mutation path.
- New code cannot import deprecated patron bridge APIs.

### D2. Type safety and error serialization

Priority: P1

Work items:

- [ ] Remove practical `as any` casts from payment repository update paths.
- [ ] Review comment repository casts around write transactions.
- [ ] Add a shared safe error serializer for API routes.
- [ ] Ensure unknown thrown values are normalized before reaching response helpers.

Acceptance criteria:

- Error responses are predictable.
- Type escapes are reduced or locally justified.
- No route returns a raw unknown thrown value.

### D3. Comment reaction write path

Priority: P2

Work items:

- [ ] Review reaction create/delete query sequence.
- [ ] Reduce unnecessary follow-up writes if feasible.
- [ ] Add tests for counter consistency across repeated like/unlike operations.

Acceptance criteria:

- Counter updates remain correct under repeated operations.
- Any extra write is intentional and documented.

## Workstream E — tests and launch confidence

Goal: make the project clean enough to evolve without fear.

### E1. Integration tests for critical flows

Priority: P1

Recommended files:

- [ ] `tests/integration/video-access-control.test.ts`
- [ ] `tests/integration/payment-to-patron-flow.test.ts`
- [ ] `tests/integration/comment-visibility.test.ts`
- [ ] `tests/integration/resend-webhook-auth.test.ts`

Acceptance criteria:

- Tests cover module boundaries, not only isolated helpers.
- Tests verify final domain state.
- Tests run in CI or are clearly separated if they require extra services.

### E2. Minimal E2E smoke paths

Priority: P2

Recommended flows:

- [ ] Visitor opens homepage and public video.
- [ ] Signed-in user opens logged-in video.
- [ ] Non-patron sees patron lock state.
- [ ] Admin creates or edits a video.
- [ ] User creates, deletes, or reports a comment.

Acceptance criteria:

- E2E stays small and stable.
- It catches broken glue between UI, auth, and API without duplicating every unit test.

## Workstream F — performance and operational documentation

Goal: prevent launch-time surprises.

### F1. Query/index review

Priority: P2

Work items:

- [ ] Inspect high-traffic video listing queries.
- [ ] Confirm indexes support status, publish window, creator, and ordering filters.
- [ ] Add migrations only when query plans justify them.

Acceptance criteria:

- Index changes are evidence-based.
- List pages have known query shape and expected performance.

### F2. API route contract inventory

Priority: P2

Work items:

- [ ] Inventory critical API routes.
- [ ] Document auth requirement, payload schema, success response, and failure codes.
- [ ] Keep route docs close to Zod schemas or generate them later.

Acceptance criteria:

- Future audits can quickly tell what each route accepts and returns.
- Route contracts do not drift silently from implementation.

### F3. Launch and rollback checklist refresh

Priority: P2

Status: PARTIAL. #1091 added `docs/launch/production-evidence-runbook.md`; production/operator evidence is still tracked separately in #956/#1031/#951.

Work items:

- [x] Add a launch evidence collection runbook for deployment, config, content, smoke, integrations, and rollback evidence.
- [ ] Verify deployment checklist against current architecture with real production/operator evidence.
- [ ] Add or reconcile pre-launch checks for CSP, webhook secrets, Stripe, Clerk, Resend, video access, and database smoke tests.
- [x] Add rollback steps to the production evidence runbook.

Acceptance criteria:

- [x] Operator has a runbook for collecting launch/rollback evidence without exposing secrets.
- [ ] Launch checklist reflects current code and real production evidence, not old architecture.

## Suggested immediate next actions after #1091

1. Create the **CSP strictness PR** first if browser security hardening is the next priority.
2. Create the **Patron authorization guard PR** second to convert `PatronGrant` truth tests into architecture/lint enforcement.
3. Create the **Patron legacy cleanup PR** third to retire deprecated mutation bridges.
4. Create the **Type/error cleanup PR** fourth to normalize unsafe casts and error serialization.
5. Use later PRs for API route docs, focused integration/E2E, and performance/query review.

## What not to do

- Do not delete patron cache fields until every backend access path is proven clean and guarded.
- Do not complete CSP hardening without checking Clerk, Stripe, Next.js scripts, embeds, and preview deployments.
- Do not mix payment refactors with CSP or UI cleanup.
- Do not add broad E2E coverage before the critical unit/integration tests exist.
- Do not treat #1091 as final audit closure; it completed the access/payment/evidence-test slice only.