# LAUNCH-FIX-005 — Comments public-read / patron-write smoke test

## ID

LAUNCH-FIX-005

## Status

READY

## Lane

launch-ops

## Type

Ops smoke test / docs-only evidence

## Goal

Verify in the deployed environment that comments are publicly readable while write/react/report actions remain gated to patron/admin policy.

## Context

Comments under published videos, including patron-only videos, are visible to everyone. Commenting/reacting/reporting under patron-only video requires patron or admin. Guests can read but cannot write or report.

## Allowed files

- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**` only if moving/annotating this ticket is part of the agreed workflow
- `docs/operations/**` if a comments smoke-test checklist is needed

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

- Verify guest can read comments on a published public video.
- Verify guest can read comments on a published patron-only video.
- Verify guest cannot create, react, or report.
- Verify signed-in non-patron cannot create/react/report on patron-only video.
- Verify patron can create/react/report where policy allows.
- Verify admin can create/moderate where policy allows.
- Record exact expected UI/API results without exposing private account data.

## Validation

- `git diff --check`
- No runtime validation required.
- Confirm no forbidden files changed.

## Expected PR report

- Summary
- Reports created
- Comments smoke-test matrix by actor/action
- Gaps or unexpected behavior
- Confirmation this is docs-only
- Confirmation no runtime files changed
- Validation results
- Recommended next execution order
- Merge recommendation: MERGE / FIX / BLOCKED

## Merge recommendation rule

Recommend **MERGE** if read/write behavior is documented with enough evidence for launch readiness. Recommend **BLOCKED** if required test accounts or published videos are unavailable.
