# Active Execution Roadmap — Current Main

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE  
Launch status: NO_GO  
Last reconciled: 2026-06-30 after PR #1259

This roadmap is a current-status dashboard. It is not an executable queue, not production evidence, and not launch certification.

## Canonical execution pointers

- Current executable queue: `docs/tickets/ready/README.md`
- Full launch backlog: `docs/roadmap/Launch-Execution-Backlog.md`
- Current project state: `docs/PROJECT-STATE.md`
- Masterplan: `docs/MASTERPLAN.md`

## Current gate

| Gate | Status | Notes |
| --- | --- | --- |
| Main/build/deploy health | `ACTIVE_GUARDRAIL` | P0 failures override all product work. Vercel/CI evidence must be checked for any concrete release decision. |
| Large refactor mode | `CLOSED` | There is no active large code ticket. Work must be small and reviewable. |
| Old refactor remainder | `SMALL_REMAINDER` | Only `INCOMPLETE-006` Stripe reconciliation job and `CLEANUP-001` final legacy-service slices remain in the ready queue. |
| Active product work | `ACTIVE_PRODUCT_ROADMAP` | #1204/#1228/#1218/#1219 and current UI/product issues may continue as product containers, not as one big refactor. |
| Public launch | `NO_GO` | X7/legal/operator evidence remains incomplete. |

## Current status summary

| Area | Current status | Notes |
| --- | --- | --- |
| CI/control-plane restoration | `HISTORICAL_DONE` | PR #931/#932 and later CI-signal work are historical, not the current executable ticket. |
| Security dependency remediation | `HISTORICAL_DONE` | Historical remediation merged; do not use it as the current ticket. |
| Video provider/multi-source work | `ACTIVE_PRODUCT_WORK` | Multi-source slices merged through #1205/#1227/#1248; future provider/upload work should stay small and tied to active issues. |
| Thumbnail/private Blob display | `DONE` | PR #1256 keeps thumbnail display behind `/api/videos/[id]/thumbnail`; raw private Blob URL remains backend-only. |
| Payments admin refund/dispute | `DONE` | PR #1250 completed admin refund endpoint/UI and manual dispute sync. |
| Stripe reconciliation job | `TODO` | `INCOMPLETE-006`; no cron/reconciliation job found in current main search. |
| Legacy service cleanup | `PARTIAL` | PR #1224 and #1259 narrowed scope to `email.service.ts` and `lib/services/user/profile.service.ts`. |
| Current visual direction | `MERGED` | PR #1257 applied the najs hand-drawn style to real homepage/channel surfaces. |
| Legal/privacy/cookies/support | `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING` | Public launch remains blocked until legal/operator evidence is complete. |

## Current phase status

| Phase / Workstream | Status | Evidence needed before launch |
| --- | --- | --- |
| X1-X5 implementation foundations | `SUBSTANTIALLY_MERGED / NOT_PUBLIC_CERTIFIED` | Code/tests exist, but production/manual evidence is separate. |
| X6.1 UI consistency | `COMPLETE / HISTORICAL` | Historical inventory/evidence exists. |
| X6.2-X6.8 | `MISSING / NOT_EXECUTED` | Pass evidence required. |
| X6 certification | `MISSING / NOT_EXECUTED` | Requires X6.2-X6.8 evidence. |
| X7 Launch Evidence Pack | `INCOMPLETE` | Requires legal/runtime/operator/evidence completion. |
| X7 certification | `INCOMPLETE` | Public launch cannot proceed before certification. |

## Remaining launch path

See `docs/roadmap/Launch-Execution-Backlog.md` and `docs/tickets/ready/README.md`.

## Guardrails

- Public launch remains `NO_GO`.
- Guard PASS means documentation consistency only; it does not mean legal compliance or production evidence.
- Runtime work must start from `docs/tickets/ready/README.md` or a current GitHub issue explicitly accepted by the owner.
- Roadmap entries must not maintain an independent current-ticket pointer.
