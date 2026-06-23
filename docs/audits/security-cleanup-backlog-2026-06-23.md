# Security and quality cleanup backlog — 2026-06-23

This document records the follow-up work discovered during the deeper audit pass. It is intentionally written as an actionable backlog, not as a final vulnerability report.

Related work:
- Issue: #1086
- PR: #1087
- Branch: `fix/security-audit-priority`

## Current PR already covers

- [x] Add route-level comment text limit.
- [x] Add request body limit before JSON parsing for comments.
- [x] Add request body limit for the Resend webhook route.
- [x] Require an explicit non-production env flag for Resend legacy secret auth: `RESEND_WEBHOOK_DEV_SECRET_AUTH=true`.
- [x] Remove production eval-style script execution from CSP.
- [x] Remove `tmp-test-remove-me.txt`.
- [x] Add coverage for the new comment payload limits and CSP environment split.

## P0 — finish before considering the audit closed

### 1. Finish the CSP hardening plan

Status: partially done in #1087.

Remaining work:
- [ ] Replace remaining inline allowances with a proper nonce or hash based strategy.
- [ ] Wire nonce generation through middleware and request headers.
- [ ] Confirm Clerk and Stripe script/frame/connect requirements still work.
- [ ] Add tests that fail when production CSP allows inline or eval-style script execution.
- [ ] Document any intentionally retained exception with a reason and owner.

Why it matters: the current PR removes the most dangerous production eval-style allowance, but does not fully complete a strict CSP posture.

### 2. Add playback access-control tests

Status: not done.

Required cases:
- [ ] Guest can access PUBLIC video playback plan.
- [ ] Guest cannot access LOGGED_IN video playback plan.
- [ ] Logged-in non-patron cannot access PATRON video playback plan.
- [ ] Active patron can access PATRON video playback plan.
- [ ] Revoked patron grant no longer unlocks patron video.
- [ ] Deleted/unpublished video does not leak playable information.

Why it matters: video access is the core product boundary. The project has good architecture intent, but this path needs explicit regression tests.

### 3. Enforce PatronGrant as the backend source of truth

Status: partially documented in schema comments, not enforced by tooling.

Work items:
- [ ] Search all reads of `User.isPatron`, `patronSince`, and `patronSource`.
- [ ] Confirm those fields are only used as cache/display hints, never for backend authorization.
- [ ] Add an architecture check or lint guard for backend reads of these cache fields.
- [ ] Consider renaming these fields in a future migration to make cache intent impossible to miss.

Why it matters: `PatronGrant` should remain the only authoritative backend access source.

### 4. Verify Stripe webhook idempotency under concurrency

Status: code appears intentionally designed, but needs stress-style tests.

Work items:
- [ ] Add test for duplicate `payment_intent.succeeded` events arriving close together.
- [ ] Add test for webhook lock conflict behavior.
- [ ] Add test that a successful payment creates exactly one active `PatronGrant`.
- [ ] Add test that refund or dispute loss revokes the expected grant.

Why it matters: payments are high-impact. Idempotency bugs are expensive and hard to detect after launch.

## P1 — cleanup and maintainability

### 5. Retire deprecated patron compatibility bridges

Status: not done.

Work items:
- [ ] Locate all callers of `grantPatronStatus` and `revokePatronStatus`.
- [ ] Migrate callers to the modular patron use cases.
- [ ] Delete the deprecated bridge after callers are gone.
- [ ] Add an architecture check preventing new imports from the legacy service.

Why it matters: keeping old and new patron APIs side-by-side increases the chance of accidental misuse.

### 6. Reduce unsafe casts and weak error serialization

Status: not done.

Work items:
- [ ] Remove `as any` from payment repository update paths where practical.
- [ ] Review comment repository casts around write transactions.
- [ ] Add a shared safe error serializer for API routes.
- [ ] Avoid returning unknown thrown values through response helpers without normalization.

Why it matters: type escapes and inconsistent error handling hide bugs until runtime.

### 7. Add integration tests for the critical business flows

Status: partially covered by unit tests, not enough integration coverage.

Recommended files:
- [ ] `tests/integration/video-access-control.test.ts`
- [ ] `tests/integration/payment-to-patron-flow.test.ts`
- [ ] `tests/integration/comment-visibility.test.ts`
- [ ] `tests/integration/resend-webhook-auth.test.ts`

Why it matters: unit tests are useful, but the most important product risks sit across module boundaries.

### 8. Improve comment reaction write path

Status: not done.

Work items:
- [ ] Review reaction create/delete update sequence.
- [ ] Reduce unnecessary follow-up writes where possible.
- [ ] Add tests for counter consistency under repeated like/unlike operations.

Why it matters: reaction counters are small now, but can become a write hot path.

## P2 — performance, docs, and polish

### 9. Review indexes for public video listing queries

Status: not done.

Work items:
- [ ] Inspect high-traffic video listing queries.
- [ ] Confirm indexes support status, publish window, creator, and ordering filters.
- [ ] Add migration only if query plans justify it.

Why it matters: launch traffic usually hits list pages before anything else.

### 10. Document API route contracts

Status: not done.

Work items:
- [ ] Add a lightweight API route inventory.
- [ ] Document auth requirement, request body, response shape, and failure codes for critical routes.
- [ ] Keep this close to the implementation or generate it later from schemas.

Why it matters: it makes future audits and agent work safer.

### 11. Refresh launch and deployment checklists

Status: not verified.

Work items:
- [ ] Confirm deployment checklist matches the current architecture.
- [ ] Add explicit pre-launch checks for CSP, webhook secrets, Stripe, Clerk, Resend, and video access.
- [ ] Add rollback checklist.

Why it matters: operational docs drift quickly during fast refactors.

### 12. Add E2E coverage for the happy paths

Status: not done.

Recommended flows:
- [ ] Visitor lands on homepage and opens a public video.
- [ ] User signs in and opens logged-in video.
- [ ] Patron-only video shows lock state for non-patron.
- [ ] Admin creates or edits a video.
- [ ] Comment create/delete/report path.

Why it matters: E2E tests are slower, but they catch broken glue between UI, auth, and API.

## Notes for future work

- Keep this backlog separate from #1087 implementation details. #1087 is a first cleanup PR, not the full audit closure.
- Do not remove legacy patron fields blindly; first prove every backend access check uses `PatronGrant`.
- Do not fully tighten CSP without testing Clerk, Stripe, Next.js framework scripts, and preview deployments.
- Prefer small PRs after #1087: one for CSP, one for access tests, one for patron legacy cleanup, one for type/error cleanup.
