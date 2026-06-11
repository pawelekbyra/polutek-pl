# LAUNCH-FIX-001 — Vercel production env validation

## ID

LAUNCH-FIX-001

## Status

READY

## Lane

launch-ops

## Type

Ops validation / docs-only evidence

## Goal

Validate that Vercel production deployment configuration and environment variables are complete enough for public-launch smoke tests.

## Context

`LAUNCH-OPS-001` identified production env/secrets as the first launch-ops gate. This ticket creates evidence only; it must not change runtime code. Validate production deployment settings, env scoping, provider URL alignment, and post-deploy logs without exposing secrets.

## Allowed files

- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**` only if moving/annotating this ticket is part of the agreed workflow
- `docs/operations/**` if a launch env checklist/runbook is needed

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

- Confirm production domain, HTTPS, deployment target, and branch mapping.
- Confirm env variable presence by category without writing secret values into repo or PR.
- Confirm production/preview env separation.
- Confirm webhook routes are reachable and not blocked by deployment protection.
- Check production logs after deployment for missing env/provider auth errors.
- Create a reconciliation report with evidence, redactions, gaps, and next actions.

## Validation

- `git diff --check`
- No runtime validation required.
- Confirm no forbidden files changed.

## Expected PR report

- Summary
- Intent
- Changed files
- Vercel/env evidence collected
- Missing or uncertain envs
- Confirmation this is docs-only
- Confirmation no runtime files changed
- Validation results
- Follow-ups
- Ticket status

## Merge recommendation rule

Recommend **MERGE** only if the report documents production env readiness evidence or explicit gaps and no forbidden files changed. Recommend **FIX** for incomplete evidence formatting. Recommend **BLOCKED** if required production access/owner credentials are unavailable.
