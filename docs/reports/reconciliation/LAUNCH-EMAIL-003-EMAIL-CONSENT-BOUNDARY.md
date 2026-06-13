# LAUNCH-EMAIL-003 — Email Consent Boundary Runtime Hardening

## Ticket

LAUNCH-EMAIL-003 — Harden email consent boundary and Resend Audience runtime behavior.

Canonical ticket: `docs/tickets/ready/LAUNCH-EMAIL-003-email-consent-boundary-runtime-hardening.md`.

## Baseline

- Baseline HEAD: `70147ebfc784014d4e604b1b467b7d1f4c43a803`
- Reference commits: `3911de91e34e2b4cff6cffd8bc0583c2b9e0be45`, `5dbf5c8266c5b5bfc52c608865b61a83f5f18c71`
- Old PR #898 had an invalid non-main base.
- Branch: `fix/launch-email-003-consent-persistence-main`

## Changed files

- `lib/modules/subscriptions/infrastructure/email-preference.repository.ts`
- `lib/modules/subscriptions/application/subscribe.use-case.ts`
- `lib/modules/subscriptions/application/unsubscribe.use-case.ts`
- `tests/unit/modules/subscriptions/email-preference.repository.test.ts`
- `tests/unit/modules/subscriptions/subscriptions.use-cases.test.ts`
- `tests/unit/modules/subscriptions/subscriptions-route-boundary.test.ts`
- `docs/reports/reconciliation/LAUNCH-EMAIL-003-EMAIL-CONSENT-BOUNDARY.md`

## Implemented behavior

### Explicit opt-in
- `SubscribeUseCase` now inspects the result of `recordExplicitContentOptIn`.
- If `FOREIGN_EMAIL_CONFLICT` is returned:
  - Aborts the database transaction (via `writeTransaction` throwing).
  - Throws `AppError` (409, `EMAIL_PREFERENCE_IDENTITY_CONFLICT`).
  - No `Subscription` is created, subscriber count is not incremented, and no provider sync occurs.

### Explicit opt-out
- `UnsubscribeUseCase` remains fail-safe.
- If `FOREIGN_EMAIL_CONFLICT` is returned:
  - Continues to remove the actor's local `Subscription`.
  - Decrements subscriber count.
  - Syncs provider unsubscribe.
  - Returns `isSubscribed: false`.
  - Emits a safe structured warning without raw email or foreign ID.

### Repository behavior
- Deterministic lookup: `userId` first, then `email`.
- Consent-only fallback after P2002 on email migration.
- Reread and persist consent after P2002 on create.
- Handles legacy-row adoption races safely.
- Foreign records are never mutated and their IDs are never returned as success.
- Uses narrow structural guards for Prisma error detection.

## Test evidence

- Repository tests: 13 tests in `tests/unit/modules/subscriptions/email-preference.repository.test.ts` covering all required race and conflict scenarios.
- Use Case tests: 11 tests in `tests/unit/modules/subscriptions/subscriptions.use-cases.test.ts` proving conflict handling and fail-safe logic.
- Route Boundary tests: 8 tests in `tests/unit/modules/subscriptions/subscriptions-route-boundary.test.ts` proving HTTP 409 mapping.

## Validation results

- Typecheck: PASS
- Architecture check: PASS
- Focused tests: PASS
- Full test suite: PASS

## Production evidence

- Production/operator evidence: not added.
- Public launch: `NO_GO`.

## Recommendation

Builder recommendation: `READY_FOR_INDEPENDENT_REVIEW`
