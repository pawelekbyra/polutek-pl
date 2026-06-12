# Ready tickets — current queue

Status: `ACTIVE — CURRENT-MAIN RECONCILED`

This directory contains both genuinely ready tickets and historical/superseded ticket files that are preserved in place because the repository already has mixed ready/done conventions. Do not assume a file is currently executable merely because it is under `docs/tickets/ready/**`; read this index and the ticket status first.

## Exactly one recommended next ticket

```txt
docs/tickets/ready/X6-EX-001-ui-consistency-inventory.md
```

This is docs/inventory-only and must not modify runtime, tests, schema, packages, build config or provider implementation.

## Current queue classification

| Group | Status | Files / examples | Action |
| --- | --- | --- | --- |
| Current primary next | `READY` | `X6-EX-001-ui-consistency-inventory.md` | Assign exactly one agent if owner approves. |
| Current reconciliation ticket | `INTEGRATOR_PR_ACTIVE` | `DOCS-RECONCILE-001-current-main-source-of-truth.md` | Represents this serial-only global docs task. Do not assign separately after merge. |
| Historical/superseded control-plane tickets | `SUPERSEDED` | `X0-READY-001-r-phase-handoff-inventory.md`, `X0.5-READY-001-research-synthesis.md`, `X0.5-READY-002-owner-decisions-lock.md`, `X0.5-READY-003-product-standard.md` | Preserve for history; not the next action. |
| Merged implementation/evidence tickets | `SUPERSEDED_BY_MERGED_WORK` | X1/X2/X3/X4/LAUNCH-FIX tickets with matching reports under `docs/reports/reconciliation/**` | Do not rerun blindly; create a narrow follow-up only if the current report names a gap. |
| Production-access tickets | `READY_WHEN_OPERATOR_ACCESS_EXISTS` | `LAUNCH-FIX-001-vercel-production-env-validation.md`, `LAUNCH-FIX-002-cloudflare-webhook-production-check.md`, `LAUNCH-FIX-004-video-access-and-token-leak-smoke-test.md`, `LAUNCH-FIX-006-admin-cloudflare-upload-import-smoke-test.md`, `production-healthcheck-hardening.md`, `database-backup-restore-drill.md` | Require current production/operator access and redacted evidence. |
| Owner-decision blockers | `BLOCKED` | See `docs/tickets/blocked/**` | Owner decision required before execution/certification. |
| Launch proof | `NOT_READY_UNTIL_X6_AND_PRODUCTION_PROOF` | `X7-READY-001-launch-readiness-gap-analysis.md` | Do not certify X7 before evidence exists. |
| Admin diagnostics inventory | `READY_LATER` | `X5-READY-001-admin-cockpit-current-state-inventory.md` | Useful after X6 inventory or production diagnostics plan. |

## PR #871 collision rule

PR #871 remains `OPEN / PENDING MERGE` at reconciliation time. Do not claim its runtime changes as current-main truth and do not run/claim its branch-only tests from main.

## Naming rule after DOCS-RECONCILE-001

- Current canonical X4 is PlaybackPlan/player safety.
- Historical `X4-*` comments reports remain historical lane IDs.
- Future comments tickets should use an explicit comments lane prefix/title.
- Future playback tickets should use an explicit playback/player title such as `X4-PLAYBACK-*`.
