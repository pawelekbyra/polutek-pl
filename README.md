# Polutek.pl — Current Main Control Panel

Status: `ACTIVE — POST-R AI DELIVERY CONTROL PLANE`

This README is the owner-facing dashboard for the current documentation reconciliation state. It is not a certification report and it does not declare public launch readiness.

## Current project stage

Polutek.pl has moved beyond the obsolete "only X0 is active" snapshot. Current `main` contains substantial merged X1/X2/X3/X4/X5-era foundations plus X6/X7 documentation standards, but public launch is **not certified** because production/manual evidence is incomplete.

Current classification:

```txt
Implementation foundation: substantially present for payments/access/video/comments.
Automated evidence: present for many critical slices.
Production/manual evidence: incomplete.
Formal X6/X7 certification: not executed.
Public launch: not certified.
```

## Recent current-main foundations

- Payments/patron: one-time Stripe fulfillment records financial `Payment` facts, applies currency threshold eligibility, creates `PatronGrant`, and uses Stripe event ledger/idempotency.
- Access: patron access checks are backed by active `PatronGrant`; `User.isPatron` and Clerk metadata are display/cache diagnostics, not backend access truth.
- Video/playback: Cloudflare Stream is the first active private provider; signed Cloudflare patron playback is implemented with backend access approval before provider resolution.
- Denied playback: denied/not-ready plans fail closed without a playable source/token/provider playback call/session/view event.
- Comments: published comments are publicly readable while patron-only writing/reacting/reporting requires patron/admin access.
- Operations: production monitoring checklist, incident runbook, postmortem template and Cloudflare/admin smoke-test runbooks exist.
- Product standard: X6 Product Excellence and X7 Launch Evidence Pack standards exist, including `GO` / `CONDITIONAL_GO` / `NO_GO` semantics.

## Implemented but not production-certified

Merged code and local tests are evidence of implementation, not evidence of public-launch readiness. The following still require production/manual proof before launch certification:

- production Stripe webhook, refund/dispute and paid-but-locked evidence,
- production Cloudflare upload/import/webhook/playback evidence,
- owner/admin support-diagnostics usability proof,
- legal/privacy/cookie/support copy approval,
- alert channels/thresholds and incident ownership approval,
- backup/restore drill evidence,
- representative mobile/accessibility/performance evidence,
- X6 evidence passes and X7 Launch Evidence Pack.

## Current PR state checked during reconciliation

- PR #871, `Hardened Stripe Refund and Dispute PatronGrant Lifecycle`, is **OPEN / PENDING MERGE** and is not current-main truth. Its proposed refund/dispute lifecycle changes must not be described as implemented until merged.
- PR #868, `Stabilize Vercel build: fix fonts, sitemap, and Clerk build errors`, is **CLOSED without merge** and is not current-main truth unless identical changes are independently present on main.
- GitHub/Vercel API access from the shell was blocked by a proxy `403`; public GitHub HTML was used only to classify #871/#868 and preview deployment comments.

## Active blockers

| Blocker | Status | Launch impact |
| --- | --- | --- |
| PR #871 refund/dispute lifecycle | `BLOCKED` by pending merge/review | Payment/access lifecycle cannot be certified while open. |
| Production environment verification | `IMPLEMENTED_UNVERIFIED` / evidence incomplete | Build/deploy proof is not launch certification. |
| Provider webhook production verification | `PARTIAL` | Cloudflare runtime exists; production webhook proof remains required. |
| Legal/privacy/cookies/support copy | `OWNER_DECISION_REQUIRED` | Public launch blocker. |
| Alert channels/thresholds/RPO/RTO | `OWNER_DECISION_REQUIRED` | X7 blocker. |
| X6/X7 evidence | `MISSING` | Public launch not certified. |

## Recommended next executable ticket

Exactly one primary next ticket is recommended after this reconciliation:

```txt
docs/tickets/ready/X6-EX-001-ui-consistency-inventory.md
```

This is docs/inventory-only. It must not redesign UI, modify runtime, or certify X6/X7.

## Canonical docs

- Agent/product invariants: `AGENTS.md`
- Owner decisions: `docs/strategy/OWNER-DECISIONS.md`
- Current execution roadmap: `docs/roadmap/Active-Execution-Roadmap.md`
- Owner timeline: `docs/roadmap/OWNER-TIMELINE.md`
- Phase gates: `docs/roadmap/Phase-Gates.md`
- Reconciliation report index: `docs/reports/reconciliation/README.md`
- Current reconciliation report: `docs/reports/reconciliation/DOCS-RECONCILE-001-CURRENT-MAIN-SOURCE-OF-TRUTH.md`
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
