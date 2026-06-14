# Polutek.pl — Current Main Control Panel

Status: `ACTIVE — POST-R AI DELIVERY CONTROL PLANE`

This README is the owner-facing dashboard for the current documentation reconciliation state. It is not a certification report and it does not declare public launch readiness.

## Current project stage

Owner product direction is recorded.

Professional legal review, public legal copy, email runtime corrections, production/operator evidence, X6.2–X6.8 and X7 certification remain incomplete.

Current classification:

```txt
Implementation foundation: substantially implemented for core launch-critical domains.
Automated/local evidence: focused evidence exists for critical boundaries, but it is not production certification.
Production/manual evidence: incomplete and operator pending.
X6: X6.1 complete; X6.2–X6.8 not executed/certified.
X7: evidence pack incomplete.
Public launch: NO_GO / not certified.
```

## Core Foundations and Readiness (Current Main)

- **Payments/patron:** full Stripe lifecycle (fulfillment, refund, dispute suspension/reactivation) is merged.
- **Access:** active `PatronGrant` is the sole backend access truth; admin actions are guarded by confirmation workflows.
- **Video/playback:** Cloudflare Stream with signed tokens and hardened webhook signature verification is merged.
- **Operations:** backup/restore tooling and Vercel production environment checklist exist.
- **Owner decisions:** owner product direction is recorded in `docs/strategy/OWNER-DECISIONS.md` and `docs/strategy/OWNER-LAUNCH-DECISIONS-001.md`; it is not legal approval or production evidence.
- **X6 excellence:** X6.1 UI Consistency Inventory is complete.

## Outstanding Production Evidence and Certification

Merged code and local tests are evidence of implementation, not evidence of public-launch readiness. The following still require production/manual proof:

- **Vercel:** production environment variable validation and log review.
- **Stripe:** production lifecycle evidence (dashboard events).
- **Cloudflare:** production E2E evidence (upload/import/webhook/playback).
- **Reliability:** database backup/restore operator drill evidence.
- **Quality:** X6.2–X6.8 evidence passes and formal certification.
- **Legal:** privacy/terms/cookies/support copy professional review, owner approval and publication.
- **Compliance:** email runtime/suppression implementation.
- **X7:** Launch Evidence Pack completion.

## Active blockers

| Blocker | Status | Launch impact |
| --- | --- | --- |
| Vercel production environment verification | `BLOCKED_OPERATOR_ACCESS` | Evidence pack blocker. |
| Cloudflare production webhook/E2E evidence | `BLOCKED_OPERATOR_ACCESS` | Evidence pack blocker; authorized Cloudflare/Vercel access is required. |
| Backup/restore operator drill | `OPERATOR_PENDING` | Reliability blocker. |
| X6.2–X6.8 evidence passes | `MISSING / NOT_EXECUTED` | Certification blocker. |
| Legal/privacy/cookies/support copy | `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING` | Public launch blocker. |
| Email unsubscribe/suppression | `IMPLEMENTATION_MISSING` | Compliance blocker; runtime behavior required. |
| X7 Launch Evidence Pack | `MISSING` | Public launch not certified. |

## Current executable ticket

The sole canonical current-ticket pointer is maintained in:

`docs/tickets/ready/README.md`

This README is a project-status dashboard, not an executable queue.

## Launch backlog

The full non-executable map of remaining launch work is maintained in:

`docs/roadmap/Launch-Execution-Backlog.md`

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
- Current reconciliation report: `docs/reports/reconciliation/POST-910-CONTROL-PLANE-RECONCILIATION.md`
- Ticket queue: `docs/tickets/ready/README.md`
- Full launch backlog: `docs/roadmap/Launch-Execution-Backlog.md`

## Source-of-truth categories

- Implementation truth: current code and tests on current main.
- Product-policy truth: explicit owner decisions, `AGENTS.md`, and `docs/strategy/OWNER-DECISIONS.md`.
- Current execution-status truth: this README, `docs/roadmap/Active-Execution-Roadmap.md`, `docs/roadmap/OWNER-TIMELINE.md`, and the current ticket queue.
- Target/specification truth: `docs/specs/**`, Product Standard, phase gates, and architecture blueprint.
- Historical evidence: PR bodies, historical reconciliation reports, audits, and closed/superseded tickets.

```txt
Target architecture != current implementation.
```
