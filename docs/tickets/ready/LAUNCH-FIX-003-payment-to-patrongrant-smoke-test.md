# LAUNCH-FIX-003 — Payment to PatronGrant smoke test

## ID

LAUNCH-FIX-003

## Status

READY

## Lane

launch-ops

## Type

Ops smoke test / docs-only evidence

## Goal

Smoke-test that a qualifying one-time payment records the financial fact and creates or preserves active `PatronGrant` access truth in the deployed environment.

## Context

Patronage is not a subscription. `Payment` is a money/support event, and `PatronGrant` is access truth. This ticket proves the production-like payment-to-access path without editing runtime code.

## Allowed files

- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**` only if moving/annotating this ticket is part of the agreed workflow
- `docs/operations/**` if a payment smoke-test runbook is needed

## Forbidden files

- `lib/**`
- `app/**`
- `components/**`
- `tests/**`
- `prisma/**`
- `package.json`
- `package-lock.json`
- `README.md`
- `AGENTS.md`
- `scripts/**`
- `docs/roadmap/**`
- `docs/strategy/**`

## Required work

- Confirm Stripe secret/publishable key mode matches intended launch environment.
- Confirm Stripe webhook secret and webhook URL are production configured.
- Execute a safe qualifying payment smoke test using approved test/live procedure.
- Confirm a `Payment` record exists as financial fact.
- Confirm active `PatronGrant` exists and is access truth.
- Confirm Clerk metadata, subscription/newsletter consent, and frontend state are not used as access truth.
- Record refund/dispute handling assumptions and whether they were tested, simulated, or deferred.

## Validation

- `git diff --check`
- No runtime validation required.
- Confirm no forbidden files changed.

## Expected PR report

- Summary
- Reports created
- Payment environment checklist result
- Payment and PatronGrant smoke evidence with secrets redacted
- Refund/dispute assumptions
- Confirmation this is docs-only
- Confirmation no runtime files changed
- Validation results
- Recommended next execution order
- Merge recommendation: MERGE / FIX / BLOCKED

## Merge recommendation rule

Recommend **MERGE** if payment-to-PatronGrant evidence is documented or precise provider/access blockers are identified. Recommend **BLOCKED** if payment provider credentials, test account, or safe payment procedure are unavailable.
