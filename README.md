# Polutek.pl — Current Main Control Panel

Status: `ACTIVE — POST-R AI DELIVERY CONTROL PLANE`
Public launch: `NO_GO`

This README is the owner-facing dashboard for current documentation reconciliation state. It is not a certification report and it does not declare public launch readiness.

## Current project stage

```txt
Implementation foundation: substantial.
Automated CI debt: security remediation merged via #946, hotspot debt via #950, and coverage baseline debt via #953.
Production/manual evidence: OPERATOR_PENDING.
Legal/privacy/cookies/support copy: LEGAL_REVIEW_REQUIRED.
Public launch: NO_GO / not certified.
```

## Current executable ticket

The sole canonical current-ticket pointer is maintained in `docs/tickets/ready/README.md`.

This README intentionally does not duplicate the current ticket ID. Read `docs/tickets/ready/README.md` for the exactly one current executable ticket. If another document disagrees with that queue, reconcile the control plane before assigning runtime work.

## Launch backlog

The full non-executable map of remaining launch work is maintained in `docs/roadmap/Launch-Execution-Backlog.md`.

## Outstanding Production Evidence and Certification

Merged code and tests are evidence of implementation, not evidence of public-launch readiness. Production/manual proof remains required for Vercel, Stripe, Cloudflare, backup/restore, launch smoke coverage, legal copy, compliance email runtime, and the final launch evidence pack.

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
- Ticket queue: `docs/tickets/ready/README.md`
- Full launch backlog: `docs/roadmap/Launch-Execution-Backlog.md`

## Source-of-truth categories

- Implementation truth: current code and tests on current main.
- Product-policy truth: explicit owner decisions, `AGENTS.md`, and `docs/strategy/OWNER-DECISIONS.md`.
- Current execution-status truth: this owner dashboard and the canonical ticket queue.
- Target/specification truth: `docs/specs/**`, Product Standard, phase gates, and architecture blueprint.
- Historical evidence: PR bodies, historical reconciliation reports, audits, and closed/superseded tickets.

```txt
Target architecture != current implementation.
```