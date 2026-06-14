# EMAIL-WEBHOOK-POSTMERGE-VERIFY-001 — Verify merged Resend webhook idempotency hardening

Status: READY_FOR_CERTIFIER
Ticket ID: EMAIL-WEBHOOK-POSTMERGE-VERIFY-001
Role: Reviewer / Certifier
Launch status: NO_GO

## Purpose

Independently verify the implementation merged by PR #905 for `EMAIL-WEBHOOK-IDEMPOTENCY-001` after the post-PR #910 control-plane reconciliation. This is a read-only verification task and must not implement repairs.

## Verified Merge Context

- Implementation ticket: `EMAIL-WEBHOOK-IDEMPOTENCY-001`.
- Implementation PR: PR #905.
- Merge SHA: `36b57dec5c763ca29ff708c836dae0601125c49d`.
- CI fixture follow-up: PR #910 fixed the missing `ADMIN_CLERK_USER_IDS` CI production-env fixture.
- PR #910 merge SHA: `49695941171a4de47a22b036a0b5255c8bbd16be`.
- Public launch remains `NO_GO`; post-merge verification is not yet complete.

## Verification Goals

The Reviewer / Certifier must independently verify all of the following without applying repair changes in this ticket:

1. Implementation from PR #905 matches the intended email webhook idempotency hardening.
2. Migration behavior on a fresh database.
3. Migration behavior on an existing database.
4. Concurrency behavior.
5. Ownership/fencing behavior and stale takeover handling.
6. Route security, including behavior without required signatures.
7. PII and secret redaction.
8. Actual quality/security command results, without inflating evidence.
9. A final verification report with verdict `PASS`, `FIX_REQUIRED`, or `BLOCKED`.

## Allowed Changes

- Documentation/report-only changes that record verification evidence.
- Temporary uncommitted probes needed for local verification.

## Disallowed Changes

- Runtime fixes.
- Schema or migration fixes.
- Dependency/package changes.
- CI/workflow changes.
- Guard/script changes.
- Implementing repair tickets in the same task.

## Required Evidence Boundaries

- `env:validate:prod` evidence must be based on actual command or workflow output after PR #910.
- `integration-postgres` evidence must be based on actual command or workflow output.
- `quality:strict-escapes` evidence must be based on actual command or workflow output.
- `npm audit --audit-level=high` evidence must be based on actual command or workflow output.
- Full quality/build certification must not be declared without a complete PASS evidence set.

## Acceptance Criteria

- Verification report identifies the checked main/head baseline.
- Verification report distinguishes PR #905 implementation evidence from PR #910 CI-fixture evidence.
- Verification report records actual command/workflow results and any environment limitations.
- Verification report gives one final verdict: `PASS`, `FIX_REQUIRED`, or `BLOCKED`.
- Public launch remains `NO_GO` unless a later owner-approved launch-certification process changes it.
