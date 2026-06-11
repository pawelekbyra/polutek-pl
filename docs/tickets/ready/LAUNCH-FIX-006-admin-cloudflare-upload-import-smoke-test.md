# LAUNCH-FIX-006 — Admin Cloudflare upload/import smoke test

## ID

LAUNCH-FIX-006

## Status

READY

## Lane

launch-ops

## Type

Ops smoke test / docs-only evidence

## Goal

Verify that admin can upload or import/attach Cloudflare Stream assets and observe correct processing/READY status in the deployed environment.

## Context

Cloudflare Stream is the first provider. Legacy R2/S3/Vercel Blob may exist only as migration paths, not active safe private playback providers. Before launch, admin operations must prove at least one Cloudflare READY asset path for launch content.

## Allowed files

- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**` only if moving/annotating this ticket is part of the agreed workflow
- `docs/operations/**` if an admin upload/import runbook is needed

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

- Use an admin account in the deployed environment.
- Upload a small approved test video to Cloudflare Stream if upload is launch-scoped.
- Import or attach an existing Cloudflare/legacy-migration asset if import is launch-scoped.
- Confirm processing status appears in admin UI/logs.
- Confirm Cloudflare webhook or status polling marks asset READY.
- Confirm failed state handling is visible if a safe failed test is available.
- Confirm the READY asset can be used by a later playback smoke test without relying on legacy private playback.

## Validation

- `git diff --check`
- No runtime validation required.
- Confirm no forbidden files changed.

## Expected PR report

- Summary
- Reports created
- Admin upload/import evidence
- Cloudflare asset status evidence
- Legacy migration assumptions
- Confirmation this is docs-only
- Confirmation no runtime files changed
- Validation results
- Recommended next execution order
- Merge recommendation: MERGE / FIX / BLOCKED

## Merge recommendation rule

Recommend **MERGE** if admin upload/import/status evidence is documented or exact provider/workflow blockers are captured. Recommend **BLOCKED** if admin account, Cloudflare credentials, or launch-scoped test media are unavailable.
