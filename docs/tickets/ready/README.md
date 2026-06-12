# Ready tickets — current queue

Status: `ACTIVE — CURRENT-MAIN RECONCILED`

This directory contains both genuinely ready tickets and historical/superseded ticket files that are preserved in place because the repository already has mixed ready/done conventions. Do not assume a file is currently executable merely because it is under `docs/tickets/ready/**`; read this index and the ticket status first.

## Exactly one recommended next ticket

```txt
LAUNCH-EMAIL-003 — Harden email consent boundary and Resend Audience runtime behavior
```

## Current queue classification

| Group | Status | Files / examples | Action |
| --- | --- | --- | --- |
| Current primary next | `READY` | `LAUNCH-EMAIL-003-email-consent-boundary-runtime-hardening.md` | Assign exactly one Builder to implement the email consent / Resend Audience runtime boundary. |
| Merged owner-decision consolidation | `READY_FOR_REVIEW / MERGED BASELINE` | `OWNER-LAUNCH-DECISIONS-001-consolidate-launch-blocking-decisions.md`, `OWNER-LAUNCH-DECISIONS-001.md` | Preserve for review history; do not assign as next runtime work. |
| Merged control-plane hotfix | `MERGED / HISTORICAL` | `DOCS-RECONCILE-003-operator-evidence-status-hotfix.md` | Status semantics correction; preserve for history. |
| Historical/superseded tickets | `SUPERSEDED` | `X0-*`, `X0.5-*`, `DOCS-RECONCILE-001/002` | Preserve for history. |
| Merged runtime / local implementation | `DONE / MERGED` | `X1/X2/X3/X4/X5/X6-FU-*`, `LAUNCH-FIX-007`, `STABILIZE-*` | Foundational work merged on main. |
| Operator evidence pending | `OPERATOR_PENDING` | `LAUNCH-FIX-001 (PARTIAL / BLOCKED_OPERATOR_ACCESS)`, `LAUNCH-FIX-002 (BLOCKED_OPERATOR_ACCESS)`, `LAUNCH-OPS-002 (OPERATOR_PENDING)`, `LAUNCH-FIX-004/006 (READY_WHEN_OPERATOR_ACCESS_EXISTS)` | Do not reimplement merged runtime/checklists. Execute procedure when authorized access exists. |
| UI Excellence/Inventory | `DONE` | `X6-EX-001-ui-consistency-inventory.md` | Inventory complete; safety follow-ups merged. |
| Operator drill tickets | `OPERATOR_PENDING` | `database-backup-restore-drill.md`, `production-healthcheck-hardening.md` | Tooling exists; operator drill evidence required. |
| Production-access tickets | `READY_WHEN_OPERATOR_ACCESS_EXISTS` | `LAUNCH-FIX-004-video-access-smoke-test.md`, `LAUNCH-FIX-006-admin-cloudflare-smoke-test.md` | Require current production/operator access and redacted evidence. |
| Owner-decision blockers | `BLOCKED` | `LAUNCH-LEGAL-*`, `LAUNCH-EMAIL-002` | Owner decision required before execution/certification. |
| Launch proof | `NOT_READY_UNTIL_PRODUCTION_PROOF` | `X7-READY-001-launch-readiness-gap-analysis.md` | Do not certify X7 before evidence exists. |

## Queue source-of-truth rule

This index is the sole source for the next executable ticket. Do not infer the next ticket from filename order, roadmap prose, historical reports, or unchecked items inside already-merged ticket files. If this section and another document disagree, stop and reconcile the queue before assigning Builder work.

## Planned follow-ups (not yet ticketed)

1. Signed public unsubscribe and suppression.
2. System email event wiring and idempotency.
3. Language persistence and first-email language.
4. Optional referral progress emails.
5. Legal/privacy/terms PL+EN.
6. Operator evidence.
7. X6 and X7.

## PR #871 and #868 reconciliation

PR #871 (Stripe lifecycle) and PR #868 (Vercel build stabilization) are now fully merged/integrated on main.

## Naming rule after DOCS-RECONCILE-002

- Current canonical X4 is PlaybackPlan/player safety.
- Historical `X4-*` comments reports remain historical lane IDs.
- Future comments tickets should use an explicit comments lane prefix/title.
- Future playback tickets should use an explicit playback/player title such as `X4-PLAYBACK-*`.
