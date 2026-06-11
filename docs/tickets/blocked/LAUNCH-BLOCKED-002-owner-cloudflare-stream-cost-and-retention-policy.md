# LAUNCH-BLOCKED-002 — Owner Cloudflare Stream cost and retention policy

## ID

LAUNCH-BLOCKED-002

## Status

BLOCKED

## Lane

launch-ops

## Type

Owner decision / provider policy unblocker

## Goal

Obtain owner-approved Cloudflare Stream budget, retention, and legacy-original preservation policy before public launch and broader migration.

## Context

Cloudflare Stream is the first video provider. R2/S3/Vercel Blob may exist as legacy/migration storage, but they are not active safe private playback providers without a future architecture decision. Launch operations need an owner-approved cost and retention policy so admins know how to migrate, preserve, or remove originals.

## Blocked on

Owner decision approving:

- Cloudflare Stream budget/cost tolerance for launch and early growth.
- Whether legacy originals are preserved permanently or for a fixed period after verified Cloudflare migration.
- Minimum retention period for source/original files.
- Who can delete originals and what audit/approval is required.
- Whether any legacy video can remain non-Cloudflare at public launch.
- What to do with failed Cloudflare encodes during launch.

## Allowed files after unblock

- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**`
- `docs/tickets/blocked/**`
- `docs/operations/**` if needed for a migration/retention runbook

Runtime, schema, guard, or package changes require a separate owner-approved implementation ticket.

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
- Cloudflare cost/retention policy captured
- Remaining blocked items, if any
- Confirmation this is docs-only unless a separate owner-approved implementation ticket exists
- Confirmation no runtime files changed for this ticket
- Validation results
- Merge recommendation: MERGE / FIX / BLOCKED

## Merge recommendation rule

Keep **BLOCKED** until owner approves budget, retention, and legacy-original preservation rules. Recommend **MERGE** only for a docs-only decision capture that clearly records the owner-approved policy.
