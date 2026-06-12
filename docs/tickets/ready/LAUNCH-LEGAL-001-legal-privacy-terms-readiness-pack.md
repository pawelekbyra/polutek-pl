# LAUNCH-LEGAL-001 — Legal, privacy, terms and public-policy readiness pack

## ID

LAUNCH-LEGAL-001

## Status

READY_FOR_OWNER_REVIEW

## Lane

launch-ops

## Type

docs-only readiness / decision pack

## Owner authorization

This ticket was created from the owner prompt authorizing exactly one docs-only task: prepare a legal/privacy/terms readiness pack and keep final legal publication blocked.

## Goal

Produce a decision-ready legal/privacy/terms readiness pack based on current-main product decisions and implementation evidence without publishing final legal copy into the application.

## Scope

Allowed changed paths for this ticket:

- `docs/tickets/ready/LAUNCH-LEGAL-001-legal-privacy-terms-readiness-pack.md`
- `docs/tickets/blocked/LAUNCH-LEGAL-002-publish-owner-approved-legal-copy.md`
- `docs/operations/legal-owner-decision-questionnaire.md`
- `docs/operations/legal-privacy-terms-publication-checklist.md`
- `docs/reports/reconciliation/LAUNCH-LEGAL-001-LEGAL-PRIVACY-TERMS-READINESS-PACK.md`

Read-only inspection was allowed across runtime and docs.

## Out of scope

- No edits to `app/**`, `components/**`, `lib/**`, `tests/**`, `scripts/**`, `prisma/**`, package files, build config, environment files, README, AGENTS, roadmap, strategy, or specs.
- No publication of final terms, privacy, cookie, refund, support, or community policy copy.
- No claim that legal documents are approved, counsel-reviewed, or public-launch ready.
- No change to the existing blocker `LAUNCH-BLOCKED-001`, which remains `BLOCKED`.

## Deliverables

- Owner decision questionnaire.
- Legal/privacy/terms publication checklist.
- Readiness/reconciliation report with surface inventory, provider/data-processing inventory, contradiction matrices, cookie/tracking truth, and draft structures.
- One future implementation ticket blocked on owner/legal decisions.

## Validation commands

Run only:

```bash
git diff --check
git status --short
git diff --name-only
rg -n \
  "bezzwrotn|brak zwrot|Lifetime Total|historycznej sumy|≥ 20 PLN|zalogowan.*koment" \
  app docs
rg -n \
  "Clerk|Stripe|Cloudflare|Vercel|Resend|DATABASE_URL|cookies|localStorage|sessionStorage|analytics" \
  app lib scripts docs
rg -n \
  "regulamin|polityka-prywatnosci|privacy|terms|cookies|refund|support" \
  app components docs
```

Do not run build, lint, typecheck, or tests for this docs-only task.

## Expected PR report

- Summary.
- Baseline SHA.
- Surfaces inspected.
- Highest-risk contradictions.
- Owner decisions required.
- Legal review questions.
- Created documents.
- Confirmation docs-only.
- Blocked publication ticket.
- Validation.
- Risks.
- Next action.
- Verdict.

## Ticket status

`READY_FOR_OWNER_REVIEW` for the readiness pack.

Final publication remains `BLOCKED`.
