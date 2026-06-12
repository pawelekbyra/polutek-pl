# LAUNCH-FIX-002 — Cloudflare webhook production check

## ID

LAUNCH-FIX-002

## Status

DONE — merged on main (PR #884)

## Lane

launch-ops

## Type

Ops smoke test / docs-only evidence

## Goal

Verify that Cloudflare Stream production webhook configuration reaches the deployed app and can update video asset lifecycle state safely.

## Context

Cloudflare Stream is the first video provider. Production readiness requires account id, API token, webhook secret, webhook URL, and asset lifecycle event delivery to be correct in production. This ticket records evidence only and must not change runtime code.

## Allowed files

- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**` only if moving/annotating this ticket is part of the agreed workflow
- `docs/operations/**` if a provider webhook runbook is needed

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

- Confirm Cloudflare account id is configured in production without exposing it if considered sensitive.
- Confirm Cloudflare API token exists and is scoped for Stream upload/import/status operations.
- Confirm webhook secret exists in production.
- Confirm webhook URL uses canonical HTTPS production domain.
- Trigger or observe a Cloudflare Stream lifecycle event.
- Confirm app logs/admin state show expected asset processing/ready/failed transition.
- Confirm invalid/unsigned webhook requests are not treated as trusted events if evidence is available from tests or safe manual probe.

## Validation

- `git diff --check`
- No runtime validation required.
- Confirm no forbidden files changed.

## Expected PR report

- Summary
- Reports created
- Cloudflare env checklist result
- Webhook URL and event evidence with secrets redacted
- Asset state evidence
- Risks/gaps
- Confirmation this is docs-only
- Confirmation no runtime files changed
- Validation results
- Recommended next execution order
- Merge recommendation: MERGE / FIX / BLOCKED

## Merge recommendation rule

Recommend **MERGE** if production webhook evidence is captured or a precise external blocker is documented. Recommend **BLOCKED** if Cloudflare dashboard/production env access is unavailable.
