# Historical / superseded ticket

Status: `SUPERSEDED_BY_DOCS_RECONCILE_002`

This ticket remains in place as historical evidence. It is not the current next action. Current execution status and next ticket are defined by `docs/tickets/ready/README.md` and `docs/reports/reconciliation/DOCS-RECONCILE-002-CURRENT-MAIN.md`.

# DOCS-RECONCILE-001-current-main-source-of-truth

Status: `INTEGRATOR_PR_ACTIVE`
Lane: Control plane / documentation reconciliation
Type: Owner-authorized serial-only Integrator docs task

## Goal

Reconcile root README, AGENTS, roadmap, owner timeline, reconciliation index, ticket queue and relevant specs/reports with actual current main implementation status.

## Authorization

This is an owner-authorized Integrator task and a global-doc single-writer task. It may update global documentation files that are normally serial-only, including README, AGENTS, roadmap files, owner timeline, documentation indexes and ticket statuses.

## Allowed paths

- `README.md`
- `AGENTS.md`
- `docs/roadmap/**`
- `docs/strategy/**` only for small consistency corrections/references
- `docs/specs/**` only for small snapshot/reference sections
- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**`
- `docs/tickets/blocked/**`
- documentation index files under `docs/**`

## Forbidden paths

- `app/**`
- `components/**`
- `lib/**`
- `tests/**`
- `prisma/**`
- `scripts/**`
- `public/**`
- package/build/config/provider/generated/workflow files

## Required evidence matrix

The PR must include a matrix covering product identity, payments, PatronGrant, refunds/disputes, access, video/playback, comments, admin, email/consent, deployment, production evidence, monitoring, backup/restore, legal, accessibility/mobile/performance, Cloudflare cost/retention, X6 and X7.

## Validation

Run and report:

```bash
git diff --check
git status --short
git diff --name-only
rg -n "only X0|wyłącznie X0|X1-X7 remain inactive|X1-X7 nie są aktywne|run/assign first X0|X0-READY-001" README.md AGENTS.md docs
rg -n "10 PLN|10 USD|10 EUR|10 CHF|10 GBP" README.md AGENTS.md docs/strategy docs/specs docs/roadmap
rg -n "READY Cloudflare.*non-playable|placeholder|provider resolution gated" docs
rg -n "X4.*Playback|X4.*Comments|X4-FIX|X4-READY" docs
rg -n "LAUNCH_READY|SAFE_BASELINE|EXCELLENT_AND_STABLE" README.md AGENTS.md docs
npm run db:generate
npm run typecheck
npm run quality:architecture-boundaries
npm test -- --run tests/unit/media-source-safety.test.ts tests/unit/api/media-source-route.test.ts tests/unit/api/media-proxy-route.test.ts tests/unit/modules/video tests/unit/modules/comments tests/unit/modules/access
npm run vercel-build
```

## Definition of Done

- Root README reflects current main without launch certification.
- AGENTS includes GBP and corrected truth categories.
- Roadmap/timeline no longer claim only X0 active.
- PR #871 is represented according to its actual state.
- PR #868 is not treated as current implementation.
- Historical/current evidence are separated.
- X4/comments/playback naming collision is documented.
- Ticket queue names exactly one recommended next ticket.
- No forbidden path changes.
- Validation results are reported honestly.

## Expected PR report

Include summary, baseline SHA, open PRs, implementation truth, corrected inconsistencies, source-of-truth hierarchy, naming collision handling, ticket reconciliation, owner decisions, X1-X7 classification, launch classification, next ticket, changed files, no-runtime confirmation, validation, blockers, risks and merge recommendation.
