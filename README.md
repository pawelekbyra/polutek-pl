# Polutek.pl — Current Main Control Panel

Status: `ACTIVE — POST-R AI DELIVERY CONTROL PLANE`

This README is the owner-facing dashboard for the current documentation reconciliation state. It is not a certification report and it does not declare public launch readiness.

## Current project stage

Polutek.pl has moved beyond the foundation phase. Current `main` (PR #885) contains substantial merged X1/X2/X3/X4/X5 foundations, X6 UI consistency and safety hardening, and Vercel/Cloudflare production validation readiness. Public launch is **not certified** because production/manual evidence and owner decisions are incomplete.

Current classification:

```txt
Implementation foundation: complete for payments, access, video, comments, and admin safety.
Automated evidence: comprehensive for critical-path and security boundaries.
Production/manual evidence: unverified / operator pending.
Formal X6/X7 certification: not executed.
Public launch: not certified.
```

## Recent current-main foundations (up to PR #885)

- Payments/patron: full Stripe lifecycle (fulfillment, refund, dispute suspension/reactivation) is merged.
- Access: active `PatronGrant` is the sole backend access truth; admin actions are guarded by confirmation workflows.
- Video/playback: Cloudflare Stream with signed tokens and hardened webhook signature verification is merged.
- Safety: sitemap is hardened against DB failures; remote font dependencies are removed; playback plan-state messaging is clear.
- Operations: Vercel production environment validation and database backup/restore tooling are implemented.
- Product standard: X6 UI Consistency Inventory is complete and reviewed.

## Implemented but not production-certified

Merged code and local tests are evidence of implementation, not evidence of public-launch readiness. The following still require production/manual proof before launch certification:

- production Stripe lifecycle evidence (Stripe dashboard events),
- production Cloudflare E2E evidence (upload/import/webhook/playback),
- owner/admin support-diagnostics usability proof,
- legal/privacy/cookie/support copy approval,
- alert channels/thresholds and incident ownership approval,
- database backup/restore operator drill evidence,
- X7 Launch Evidence Pack.

## Active blockers

| Blocker | Status | Launch impact |
| --- | --- | --- |
| Legal/privacy/cookies/support copy | `OWNER_DECISION_REQUIRED` | Public launch blocker. |
| Email unsubscribe/suppression policy | `OWNER_DECISION_REQUIRED` | Compliance/launch blocker. |
| Alert channels/thresholds/RPO/RTO | `OWNER_DECISION_REQUIRED` | X7 blocker. |
| Production environment verification | `OPERATOR_PENDING` | Evidence pack blocker. |
| X7 evidence pack | `MISSING` | Public launch not certified. |

## Recommended next executable ticket

Exactly one primary next task is recommended to consolidate launch-blocking requirements:

```txt
OWNER-LAUNCH-DECISIONS-001 — Consolidate launch-blocking owner decisions
```

This is docs/inventory-only. It must not redesign UI, modify runtime, or certify X6/X7.

## Canonical docs

- Agent/product invariants: `AGENTS.md`
- Owner decisions: `docs/strategy/OWNER-DECISIONS.md`
- Current execution roadmap: `docs/roadmap/Active-Execution-Roadmap.md`
- Owner timeline: `docs/roadmap/OWNER-TIMELINE.md`
- Phase gates: `docs/roadmap/Phase-Gates.md`
- Reconciliation report index: `docs/reports/reconciliation/README.md`
- Current reconciliation report: `docs/reports/reconciliation/DOCS-RECONCILE-002-CURRENT-MAIN.md`
- Ticket queue: `docs/tickets/ready/README.md`

## Source-of-truth categories

- Implementation truth: current code and tests on current main.
- Product-policy truth: explicit owner decisions, `AGENTS.md`, and `docs/strategy/OWNER-DECISIONS.md`.
- Current execution-status truth: this README, `docs/roadmap/Active-Execution-Roadmap.md`, `docs/roadmap/OWNER-TIMELINE.md`, and the current ticket queue.
- Target/specification truth: `docs/specs/**`, Product Standard, phase gates, and architecture blueprint.
- Historical evidence: PR bodies, historical reconciliation reports, audits, and closed/superseded tickets.

```txt
Target architecture != current implementation.
```
