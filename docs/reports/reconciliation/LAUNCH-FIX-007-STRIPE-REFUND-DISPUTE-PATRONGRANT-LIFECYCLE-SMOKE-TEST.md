# LAUNCH-FIX-007 — Stripe refund/dispute PatronGrant lifecycle smoke test

Status: `IMPLEMENTED_VERIFIED` for automated/local evidence in this PR.

This report covers PR #871 branch `LAUNCH-FIX-007-stripe-lifecycle-smoke-test-14361623944252925867` after reconciliation with current `main` containing PR #873 documentation. It is not an X7 certification report and does not declare public launch readiness.

## Intent

Harden the Stripe refund/dispute → `PatronGrant` lifecycle so payment disputes fail closed for access and dispute-won events cannot reactivate grants that were permanently revoked for another reason.

## Changed files

- `lib/modules/payments/application/handle-dispute.use-case.ts`
- `lib/modules/payments/application/handle-stripe-webhook.use-case.ts`
- `lib/modules/patron/application/get-patron-status.use-case.ts`
- `tests/unit/modules/payments/stripe-lifecycle-smoke.test.ts`
- `docs/reports/reconciliation/LAUNCH-FIX-007-STRIPE-REFUND-DISPUTE-PATRONGRANT-LIFECYCLE-SMOKE-TEST.md`

## Current runtime behavior

### Full refund

Automated evidence status: `IMPLEMENTED_VERIFIED`.

A full refund sets the payment to `REFUNDED`, decrements the user payment total by the refund delta, revokes the grant tied to that `paymentId`, recalculates patron status from active grants, and syncs the resulting access cache.

Duplicate full-refund events with no additional refund delta are idempotent: they do not decrement totals again and do not re-run grant revocation.

### Partial refund

Decision status: `OWNER_DECISION_REQUIRED`.

Current runtime behavior was not changed in this PR: a partial refund updates `refundedAmountMinor`, sets payment status to `PARTIALLY_REFUNDED`, decrements the payment total by the refund delta, and recalculates patron status from active grants. This report does not describe that behavior as accepted product policy. `OQ-001` remains open and requires an owner decision before certification.

### Dispute opened

Automated evidence status: `IMPLEMENTED_VERIFIED`.

A dispute-opened event sets the payment to `DISPUTED`, temporarily revokes the payment-linked grant by setting `revokedAt`, stores a reason containing the Stripe dispute lifecycle identifier, recalculates patron status from active grants, and syncs the resulting access cache. Access is denied because there is no active `PatronGrant` for that payment.

Duplicate dispute-opened events are idempotent for state: once the grant is already revoked, a replay does not create additional grants or reactivate access.

### Dispute won

Automated evidence status: `IMPLEMENTED_VERIFIED`.

Dispute-won reactivation is guarded. The handler only clears `revokedAt` when all of these are true:

1. the payment is not in a terminal full-refund or chargeback-lost state,
2. the incoming event includes the Stripe dispute lifecycle identifier,
3. the grant has the same `paymentId`,
4. the grant is currently revoked, and
5. the grant reason exactly matches the temporary dispute-suspension reason for the same Stripe dispute lifecycle.

This prevents a dispute-won event from reactivating grants permanently revoked by full refund, dispute lost/chargeback, manual revoke, or another policy decision.

### Dispute lost / chargeback lost

Automated evidence status: `IMPLEMENTED_VERIFIED`.

A dispute-lost event moves the payment to `CHARGEBACK_LOST`, decrements the remaining non-refunded payment total exactly once, permanently revokes the payment-linked grant with a lost-dispute reason, recalculates patron status from active grants, and syncs the resulting access cache.

Duplicate dispute-lost events are idempotent for totals and grant state because payments already in `CHARGEBACK_LOST` are ignored.

### User.isPatron

Automated evidence status: `IMPLEMENTED_VERIFIED`.

`User.isPatron` is treated as a cache/read-model field, not access truth. The patron status read model now reports patron status from active `PatronGrant` rows instead of trusting stale `User.isPatron` values.

## Production/manual Stripe evidence

Status: `IMPLEMENTED_UNVERIFIED`.

This PR adds automated/local smoke coverage only. It does not perform live Stripe calls and does not prove production webhook delivery, production refund/dispute event ordering, Stripe dashboard behavior, production Clerk cache sync, or paid-but-locked support diagnostics.

## Scope confirmation

Changed only focused payment/patron runtime, focused payment tests, and this PR reconciliation report. No global documentation from PR #873 was edited.

## What did not change

- No schema or migration changes.
- No `package.json` or `package-lock.json` changes.
- No global README, AGENTS, roadmap, phase-gate, architecture blueprint, or owner-decision edits.
- No video/playback/comments runtime changes.
- No new dependencies.
- No live Stripe calls.
- No public-launch or X7 certification claim.

## Conflict resolution

Current working copy started from current `main` after PR #873. The PR #873 global documentation state was preserved. No global-doc conflict was resolved by editing PR #873 files. The Stripe lifecycle branch work was reapplied as focused payment/patron changes plus this PR report.

## Validation

Required validation commands for this task:

```bash
git diff --check
npm test -- --run tests/unit/modules/payments/stripe-lifecycle-smoke.test.ts
npm test -- --run tests/unit/modules/payments tests/unit/modules/patron
npm run typecheck
npm run quality:architecture-boundaries
```

Final command results are recorded in the PR body and final agent response.

## Risks

- The temporary suspension marker uses existing `PatronGrant.reason` text because schema/migration changes were explicitly forbidden. This is intentionally minimal but less robust than a dedicated lifecycle/audit model.
- Production/manual Stripe evidence remains missing and must not be inferred from local tests.
- Partial-refund product policy remains `OWNER_DECISION_REQUIRED`.

## Follow-ups

- `OQ-001`: owner decision for partial-refund patron policy remains required.
- Production Stripe refund/dispute evidence remains required before X7 launch certification.
- Recommended next executable ticket from current `main` / PR #873 documentation remains `docs/tickets/ready/X6-EX-001-ui-consistency-inventory.md` after PR #871 is resolved/merged.

## Ticket status

Verdict: `MERGE` if required validation remains green in CI and reviewer accepts the no-schema reason-marker guard as sufficient for this launch-fix scope.
