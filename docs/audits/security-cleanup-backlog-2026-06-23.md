# Security and quality cleanup roadmap — 2026-06-23

This document turns the deeper audit notes into an execution roadmap. It is not meant to be a final vulnerability report. Its purpose is to keep the cleanup ordered, measurable, and safe to execute in small pull requests.

Related work:
- Issue: #1086
- PR: #1087
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

### Not yet closed by #1087

- [ ] Full CSP nonce/hash strategy.
- [ ] Playback access-control regression tests.
- [ ] Tooling that prevents backend authorization from using patron cache fields.
- [ ] Stripe webhook concurrency/idempotency tests.
- [ ] Deprecated patron bridge removal.
- [ ] Type and error-handling cleanup.
- [ ] Integration/E2E test expansion.
- [ ] API and launch documentation refresh.

## Execution model

Do not turn this into one giant cleanup PR. Split it into focused PRs that can be reviewed and reverted independently.

Recommended PR order:

1. **Finish #1087** — current hardening and body-limit PR.
2. **Access tests PR** — add playback and PatronGrant source-of-truth tests without large refactors.
3. **CSP strictness PR** — complete nonce/hash strategy and document required exceptions.
4. **Patron legacy cleanup PR** — remove or fence deprecated compatibility bridges.
5. **Payment idempotency PR** — add duplicate/concurrent webhook tests and patch gaps.
6. **Type/error cleanup PR** — remove weak casts and normalize API error serialization.
7. **Operational polish PR** — API docs, launch checklist, E2E smoke paths.

## Definition of done for the audit cleanup

The audit cleanup is considered complete only when all of these are true:

- [ ] Every backend patron access decision is proven to use `PatronGrant` or a domain use case backed by `PatronGrant`.
- [ ] Cache/display fields such as `User.isPatron`, `patronSince`, and `patronSource` cannot be accidentally used for backend authorization without a guard failing.
- [ ] Playback access has regression tests for guest, logged-in, active patron, revoked patron, unpublished video, and missing video cases.
- [ ] Stripe webhook processing has duplicate event and close-arrival tests.
- [ ] Resend webhook non-production secret auth is opt-in and tested.
- [ ] Critical request bodies are bounded before JSON parsing.
- [ ] Production CSP is intentionally strict, tested, and documented.
- [ ] Deprecated patron compatibility bridges are removed or blocked from new usage.
- [ ] Critical API routes have documented auth, payload, success, and error contracts.
- [ ] CI includes the relevant unit/integration checks.

## Workstream A — access and authorization

Goal: prove that users cannot reach content or capabilities they should not reach.

### A1. Playback access-control tests

Priority: P0

Add tests for:

- [ ] Guest + PUBLIC video returns playable/access-ready state.
- [ ] Guest + LOGGED_IN video returns login-required state.
- [ ] Guest + PATRON video returns login-required or patron-required state, according to product policy.
- [ ] Logged-in non-patron + PATRON video returns patron-required state.
- [ ] Active patron + PATRON video returns playable/access-ready state.
- [ ] Revoked patron grant + PATRON video does not unlock access.
- [ ] Unpublished/deleted/missing video does not leak playback data.

Acceptance criteria:

- Tests exercise the same use case or route used by production playback.
- Tests assert both status and absence/presence of sensitive playback data.
- Tests fail if someone later swaps back to cache-only patron checks.

### A2. PatronGrant source-of-truth enforcement

Priority: P0

Work items:

- [ ] Search all reads of `User.isPatron`, `patronSince`, and `patronSource`.
- [ ] Classify each read as display/cache sync/admin statistics/backend access.
- [ ] Move any backend authorization read to `PatronGrant` or a domain use case backed by it.
- [ ] Add an architecture check or lint rule that blocks backend access decisions from reading patron cache fields.
- [ ] Document allowed exceptions.

Acceptance criteria:

- Backend authorization cannot silently rely on patron cache fields.
- Allowed cache-field reads are listed and intentional.
- A new accidental backend read fails CI or architecture validation.

## Workstream B — webhooks and payments

Goal: make money-related flows deterministic, idempotent, and recoverable.

### B1. Stripe webhook concurrency/idempotency tests

Priority: P0

Add tests for:

- [ ] Duplicate successful payment event creates exactly one successful payment transition.
- [ ] Duplicate successful payment event creates exactly one active patron grant.
- [ ] Close-arrival duplicate event returns safely without double fulfillment.
- [ ] Lock conflict behavior is documented and tested.
- [ ] Refund or dispute-loss event revokes the expected grant and does not revoke unrelated grants.

Acceptance criteria:

- Tests cover event replay and close-arrival behavior.
- Tests assert final database state, not only response status.
- Any unresolved crash-window behavior is documented with a remediation task.

### B2. Resend webhook hardening follow-up

Priority: P1

Work items:

- [ ] Add a focused test showing non-production secret auth is rejected unless `RESEND_WEBHOOK_DEV_SECRET_AUTH=true`.
- [ ] Add a focused test for oversized body rejection.
- [ ] Add a focused test for malformed JSON in the legacy non-production path.
- [ ] Confirm preview deployments do not enable the opt-in flag by default.

Acceptance criteria:

- Preview deployments are safe by default.
- Non-production convenience auth is explicit, documented, and tested.

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

Work items:

- [ ] Verify deployment checklist against current architecture.
- [ ] Add pre-launch checks for CSP, webhook secrets, Stripe, Clerk, Resend, video access, and database smoke tests.
- [ ] Add rollback steps.

Acceptance criteria:

- Operator can deploy or roll back without reverse-engineering the app.
- Launch checklist reflects current code, not old architecture.

## Suggested immediate next actions after #1087

1. Create the **Access tests PR** first. It gives the highest confidence with the least product risk.
2. Create the **PatronGrant guard PR** second. It prevents future regressions around the most sensitive domain invariant.
3. Create the **CSP strictness PR** third. It is important but should be isolated because it can break third-party scripts and Next.js runtime behavior.
4. Create the **Stripe idempotency PR** fourth. Keep it focused on tests first, then patch only proven gaps.
5. Use later PRs for cleanup, docs, E2E, and performance.

## What not to do

- Do not delete patron cache fields until every backend access path is proven clean.
- Do not complete CSP hardening without checking Clerk, Stripe, Next.js scripts, embeds, and preview deployments.
- Do not mix payment refactors with CSP or UI cleanup.
- Do not add broad E2E coverage before the critical unit/integration tests exist.
- Do not merge #1087 as the final audit closure; it is only the first hardening pass.
