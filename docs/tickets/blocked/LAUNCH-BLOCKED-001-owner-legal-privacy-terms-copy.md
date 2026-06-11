# LAUNCH-BLOCKED-001 — Owner legal/privacy/terms copy

## ID

LAUNCH-BLOCKED-001

## Status

BLOCKED

## Lane

launch-ops

## Type

Owner decision / legal-content unblocker

## Goal

Obtain owner-approved legal, privacy, terms, cookie, refund/support, and launch-facing policy copy required before public launch.

## Context

Launch is public, not a private beta. Future agents should not invent binding legal/privacy/terms copy without owner approval. This ticket is blocked until the owner supplies approved copy or explicitly authorizes a source and review path.

## Blocked on

Owner decision approving:

- Terms of use / service copy.
- Privacy policy copy.
- Cookie/tracking notice copy if applicable.
- Refund/support contact policy copy for one-time support/donation patronage.
- Where these documents must appear in production.
- Whether counsel review is required before publication.

## Allowed files after unblock

- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**`
- `docs/tickets/blocked/**`
- `docs/operations/**` if needed for a publication checklist

Runtime/UI/content file paths must be specified by a new owner-approved implementation ticket if copy is to be added to the app.

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

## Validation

- `git diff --check`
- No runtime validation required.
- Confirm no forbidden files changed.

## Expected PR report

- Summary
- Owner decision received
- Reports created
- Remaining blocked items, if any
- Confirmation this is docs-only unless a separate owner-approved implementation ticket exists
- Confirmation no runtime files changed for this ticket
- Validation results
- Merge recommendation: MERGE / FIX / BLOCKED

## Merge recommendation rule

Keep **BLOCKED** until owner-approved copy and publication requirements are provided. Recommend **MERGE** only for a docs-only decision capture that clearly records the owner-approved unblock conditions.
