# Ready tickets — current queue

Status: `ACTIVE — CURRENT-MAIN RECONCILED`

This directory contains both genuinely ready tickets and historical/superseded ticket files that are preserved in place because the repository already has mixed ready/done conventions. Do not assume a file is currently executable merely because it is under `docs/tickets/ready/**`; read this index and the ticket status first.

## Exactly one recommended next ticket

```txt
OWNER-LAUNCH-DECISIONS-001 — Consolidate launch-blocking owner decisions
```

## Current queue classification

| Group | Status | Files / examples | Action |
| --- | --- | --- | --- |
| Current primary next | `READY` | `OWNER-LAUNCH-DECISIONS-001-consolidate-launch-blocking-decisions.md` | Assign exactly one agent to consolidate decisions. |
| Current reconciliation ticket | `INTEGRATOR_PR_ACTIVE` | `DOCS-RECONCILE-002-current-main.md` | Represents this serial-only global docs task. Do not assign separately after merge. |
| Historical/superseded tickets | `SUPERSEDED` | `X0-*`, `X0.5-*`, `DOCS-RECONCILE-001` | Preserve for history; not the next action. |
| Merged implementation tickets | `DONE / MERGED` | `X1/X2/X3/X4/X5/X6-FU-*`, `LAUNCH-FIX-001/002/007`, `STABILIZE-*` | Do not rerun; foundational work is on main. |
| UI Excellence/Inventory | `DONE` | `X6-EX-001-ui-consistency-inventory.md` | Inventory complete; safety follow-ups merged. |
| Operator drill tickets | `OPERATOR_PENDING` | `database-backup-restore-drill.md`, `production-healthcheck-hardening.md` | Tooling exists; operator drill evidence required. |
| Production-access tickets | `READY_WHEN_OPERATOR_ACCESS_EXISTS` | `LAUNCH-FIX-004-video-access-smoke-test.md`, `LAUNCH-FIX-006-admin-cloudflare-smoke-test.md` | Require current production/operator access and redacted evidence. |
| Owner-decision blockers | `BLOCKED` | `LAUNCH-LEGAL-*`, `LAUNCH-EMAIL-002` | Owner decision required before execution/certification. |
| Launch proof | `NOT_READY_UNTIL_PRODUCTION_PROOF` | `X7-READY-001-launch-readiness-gap-analysis.md` | Do not certify X7 before evidence exists. |

## PR #871 and #868 reconciliation

PR #871 (Stripe lifecycle) and PR #868 (Vercel build stabilization) are now fully merged/integrated on main (up to PR #885).

## Naming rule after DOCS-RECONCILE-002

- Current canonical X4 is PlaybackPlan/player safety.
- Historical `X4-*` comments reports remain historical lane IDs.
- Future comments tickets should use an explicit comments lane prefix/title.
- Future playback tickets should use an explicit playback/player title such as `X4-PLAYBACK-*`.
