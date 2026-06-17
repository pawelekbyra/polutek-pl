# Polutek.pl — Current Main Control Panel

Status: `ACTIVE — POST-R AI DELIVERY CONTROL PLANE`
Public launch: `NO_GO`

This README is the owner-facing dashboard for current documentation reconciliation state. It is not a certification report and it does not declare public launch readiness.

## Current reconciliation

Current reconciliation report: `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`.

Baseline recorded by that report: current workspace HEAD `6162ed6b79d412856c02c4cb5c610f4f9f81b152` after PR #929. This is dated evidence from 2026-06-17, not an eternally current Git head claim.

## Current project stage

```txt
Implementation foundation: substantial, but PRs #922-#929 exposed stale control-plane state and unverified runtime/provider claims.
Automated/local evidence: incomplete because CI signal is not currently reliable.
Production/manual evidence: incomplete and operator pending.
X6: X6.1 complete; X6.2-X6.8 not executed/certified.
X7: evidence pack incomplete.
Public launch: NO_GO / not certified.
```

## Active emergency classifications

| Area | Current classification | Launch impact |
| --- | --- | --- |
| CI signal | `P0 / RESTORATION_REQUIRED` | Further runtime work blocked until CI checks are independently visible. |
| Admin auth | `IMPLEMENTATION_MERGED / REVERIFICATION_REQUIRED` | PR #923 PASS is incomplete for current main because PR #929 repaired a legacy AccessPolicy path later. |
| Admin video / Cloudflare | `PARTIAL_IMPLEMENTATION_MERGED_IN_PR_926 / CORRECTIVE_WORK_REQUIRED` | Upload/attach/provider privacy must not be used in production until containment and verification. |
| Admin channel | `SYMPTOM_PARTIALLY_HANDLED / ROOT_CAUSE_NOT_VERIFIED` | Production DB/log evidence and strict typing remain required. |
| Control plane | `EMERGENCY_RECONCILED_FOR_REVIEW` | Queue now points to CI-SIGNAL-RESTORATION-001. |

## Standing production prohibition

Do not use in production until a later verified runtime PR permits it:

```txt
Upload
Generuj Upload URL
Podepnij UID
```

## Current executable ticket

The sole canonical current-ticket pointer is maintained in `docs/tickets/ready/README.md`.

Exactly one current executable ticket after this reconciliation: `CI-SIGNAL-RESTORATION-001`.

## Launch backlog

The full non-executable map of remaining launch work is maintained in `docs/roadmap/Launch-Execution-Backlog.md`.

## Outstanding Production Evidence and Certification

Merged code and local tests are evidence of implementation, not evidence of public-launch readiness. Production/manual proof remains required for Vercel, Stripe, Cloudflare, backup/restore, X6.2-X6.8, legal copy, compliance email runtime, and X7 Launch Evidence Pack.

## Governance & Masterplan

- **Bolek Operating Model:** [docs/governance/BOLEK-OPERATING-MODEL.md](docs/governance/BOLEK-OPERATING-MODEL.md)
- **Technical Masterplan:** [docs/MASTERPLAN.md](docs/MASTERPLAN.md)
- **Core Architecture Invariants:** [docs/architecture/CORE-INVARIANTS.md](docs/architecture/CORE-INVARIANTS.md)

## Canonical docs

- Agent/product invariants: `AGENTS.md`
- Owner decisions: `docs/strategy/OWNER-DECISIONS.md`
- Current execution roadmap: `docs/roadmap/Active-Execution-Roadmap.md`
- Owner timeline: `docs/roadmap/OWNER-TIMELINE.md`
- Phase gates: `docs/roadmap/Phase-Gates.md`
- Reconciliation report index: `docs/reports/reconciliation/README.md`
- Current reconciliation report: `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`
- Ticket queue: `docs/tickets/ready/README.md`
- Full launch backlog: `docs/roadmap/Launch-Execution-Backlog.md`

## Source-of-truth categories

- Implementation truth: current code and tests on current main.
- Product-policy truth: explicit owner decisions, `AGENTS.md`, and `docs/strategy/OWNER-DECISIONS.md`.
- Current execution-status truth: this README, roadmap, owner timeline, and current ticket queue.
- Target/specification truth: `docs/specs/**`, Product Standard, phase gates, and architecture blueprint.
- Historical evidence: PR bodies, historical reconciliation reports, audits, and closed/superseded tickets.

```txt
Target architecture != current implementation.
```

## Closed decision status vocabulary

Legal/privacy/cookies/support copy remains `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`; partial refund runtime, email content notifications, RPO/RTO, alert channel, Cloudflare originals, and reactions/hearts use closed decision statuses and remain respectively `IMPLEMENTATION_MISSING`, `OPERATOR_PENDING`, `RECORDED`, `HISTORICAL`, `SUPERSEDED`, or `NOT_LAUNCH_CRITICAL` as applicable.
