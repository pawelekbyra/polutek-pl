# Active Execution Roadmap — Current Main

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE
Launch status: NO_GO

This roadmap is a current-status dashboard. It is not an executable queue, not production evidence, and not launch certification.

## Canonical execution pointers

- Current executable ticket: `docs/tickets/ready/README.md`
- Full launch backlog: `docs/roadmap/Launch-Execution-Backlog.md`

Every next-ticket field in this roadmap resolves to: See canonical ticket queue.

## X0.5 — Owner direction and launch blockers

Owner product direction recorded; legal review and implementation remain.

| Area | Current status | Notes |
| --- | --- | --- |
| Owner product decisions | `RECORDED` | Owner decisions from 2026-06-12 are product-policy truth, not implementation or legal evidence. |
| Partial refund policy | `IMPLEMENTATION_MISSING` | Owner direction recorded: no standard partial refunds; unexpected partial refund requires manual review. |
| Email/content-notification boundary | `IMPLEMENTATION_MISSING` | Owner direction recorded; runtime hardening remains. |
| Legal/privacy/cookies/support copy | `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING` | Professional legal review and public PL/EN copy remain. |
| RPO/RTO | `OPERATOR_PENDING` | Owner direction recorded: RPO 24h, RTO 48h; evidence remains. |
| Alert channel | `OPERATOR_PENDING` | Owner direction recorded: `support@polutek.pl`; setup/evidence remains. |
| Cloudflare originals/retention | `OPERATOR_PENDING` | Owner direction recorded; originals preserved outside Cloudflare require evidence. |
| Reactions/hearts launch scope | `RECORDED / NOT_LAUNCH_CRITICAL` | Owner direction recorded: reactions/hearts are not launch-critical. |

Next executable ticket: See canonical ticket queue.

## Current phase status

| Phase / Workstream | Status | Evidence needed before launch |
| --- | --- | --- |
| X1–X5 implementation foundations | `SUBSTANTIALLY_MERGED` | Code/tests exist, but production/manual evidence is still separate. |
| X6.1 UI consistency | `COMPLETE` | Historical inventory/evidence exists. |
| X6.2 State completeness | `MISSING / NOT_EXECUTED` | Pass evidence required. |
| X6.3 Responsive/browser | `MISSING / NOT_EXECUTED` | Pass evidence required. |
| X6.4 Accessibility | `MISSING / NOT_EXECUTED` | Pass evidence required. |
| X6.5 Performance | `MISSING / NOT_EXECUTED` | Pass evidence required. |
| X6.6 Copy/trust | `MISSING / NOT_EXECUTED` | Pass evidence required after legal/public copy. |
| X6.7 Owner/admin usability | `MISSING / NOT_EXECUTED` | Pass evidence required. |
| X6.8 Representative user validation | `MISSING / NOT_EXECUTED` | Pass evidence required. |
| X6 certification | `MISSING / NOT_EXECUTED` | Requires X6.2–X6.8 evidence. |
| X7 Launch Evidence Pack | `INCOMPLETE` | Requires legal/runtime/operator/evidence completion. |
| X7 certification | `INCOMPLETE` | Public launch cannot proceed before certification. |

## Production/operator evidence blockers

| Evidence area | Status | Notes |
| --- | --- | --- |
| Vercel production environment verification | `BLOCKED_OPERATOR_ACCESS` | Operator access and redacted evidence required. |
| Stripe production evidence | `OPERATOR_PENDING` | Controlled minimum tip, PatronGrant, full refund and redacted evidence required. |
| Cloudflare production evidence | `BLOCKED_OPERATOR_ACCESS` | Upload/import, webhook, signed playback, denied playback and original-file evidence required. |
| Backup, restore and alerts | `OPERATOR_PENDING` | Restore drill, RPO 24h, RTO 48h and alert delivery to `support@polutek.pl` required. |

## Remaining launch path

See the full non-executable backlog: `docs/roadmap/Launch-Execution-Backlog.md`.

See the canonical current executable ticket queue: `docs/tickets/ready/README.md`.

## Guardrails

- Public launch remains `NO_GO`.
- Guard PASS means documentation consistency only; it does not mean legal compliance or production evidence.
- Runtime work must start from the single current ticket in `docs/tickets/ready/README.md`.
- Roadmap entries must not maintain an independent current-ticket pointer.
