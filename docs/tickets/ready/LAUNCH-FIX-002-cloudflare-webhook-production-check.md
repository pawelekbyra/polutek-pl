# LAUNCH-FIX-002 — Cloudflare webhook production check

## ID

LAUNCH-FIX-002

## Status

BLOCKED_OPERATOR_ACCESS — live production webhook check not completed

## Lane

launch-ops

## Type

Ops smoke test / docs-only evidence

## Goal

Verify that Cloudflare Stream production webhook configuration reaches the deployed app and can update video asset lifecycle state safely.

## Related implementation already merged

- Cloudflare webhook HMAC/timestamp verification has been merged (PR #884).
- Local tests verify the security boundary and signature validation logic.
- This is evidence of implementation, but not evidence of correct production configuration.

## Outstanding production evidence

The following must be verified by an authorized operator before this ticket is considered complete:

1. Confirmation of the correct Cloudflare account/project.
2. Confirmation of a properly scoped API token (without revealing the value).
3. Confirmation of the production webhook signing secret.
4. Confirmation of the canonical HTTPS webhook URL.
5. Confirmation that Vercel deployment protection (if any) does not block the webhook.
6. Triggering or observing a live Cloudflare Stream lifecycle event.
7. Confirmation of the expected `VideoAsset` state transition in the database.
8. Inspection of production logs to ensure no secret/PII leakage.
9. Verified rejection of invalid/unsigned webhook requests.
10. Recording of redacted evidence references in the reconciliation report.

Do not reimplement PR #884.
Do execute this production evidence ticket when operator access exists.
The ticket becomes complete only after live evidence is captured and reconciled.

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
