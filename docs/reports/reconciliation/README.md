# Reconciliation reports

Status: `ACTIVE — CURRENT-MAIN RECONCILED`

Reconciliation reports explain how current code, tests, docs, tickets and owner decisions align at a point in time. They are evidence, not certification by themselves.

## How to read these reports

- A `MERGE` recommendation means the report's PR was safe to merge for its ticket scope. It does **not** mean `LAUNCH_READY`.
- Historical reports preserve the state and validation from the time they were written.
- Superseded reports should point to newer canonical evidence instead of rewriting old conclusions.
- Open/unmerged PR reports are not current-main truth until merged.
- Production/manual evidence must be explicitly identified; local tests and merged code are not production certification.

## Current canonical report

- Current global source-of-truth reconciliation: `docs/reports/reconciliation/DOCS-RECONCILE-002-CURRENT-MAIN.md`.

## Domain index

| Domain | Current canonical evidence | Historical / superseded notes |
| --- | --- | --- |
| Control plane / product standard | `DOCS-RECONCILE-002-CURRENT-MAIN.md`, `DNA-EXCELLENCE-001-PRODUCT-EXCELLENCE-AND-LAUNCH-PROOF.md` | X0 activation and DOCS-RECONCILE-001 are historical/superseded. |
| Payments / patron / access | `LAUNCH-FIX-007-STRIPE-REFUND-DISPUTE-PATRONGRANT-LIFECYCLE-SMOKE-TEST.md`, `X1-FIX-001-PAYMENT-ELIGIBILITY-POLICY.md`, `X2-FIX-001-CHECK-VIDEO-ACCESS-PATRONGRANT-TRUTH.md` | Full Stripe lifecycle foundations are now merged on main (PR #871 integrated). |
| Video / playback | `X3-FIX-011-CLOUDFLARE-SIGNED-PLAYBACK-RUNTIME.md`, `LAUNCH-FIX-002-CLOUDFLARE-WEBHOOK-PRODUCTION-CHECK.md` | Webhook signature hardening is merged. |
| Comments | `LAUNCH-FIX-005-COMMENTS-PUBLIC-READ-PATRON-WRITE-SMOKE-TEST.md` | These `X4-*` IDs are historical comments lane IDs. |
| Admin | `X6-FU-001-admin-access-actions-confirmation.md`, `X6-EX-001-UI-CONSISTENCY-INVENTORY.md` | Admin confirmation safety is merged. |
| Email / consent | `LAUNCH-EMAIL-001-EMAIL-CONSENT-UNSUBSCRIBE-SUPPRESSION-READINESS.md` | Suppression/provider proof remains pending. |
| Launch operations | `LAUNCH-FIX-001-VERCEL-PRODUCTION-ENV-VALIDATION.md`, `LAUNCH-OPS-002-DATABASE-BACKUP-RESTORE-READINESS.md` | Production env validation (PR #885) and backup tooling are merged. |
| Monitoring / incidents | `LAUNCH-OPS-003-PRODUCTION-MONITORING-AND-INCIDENT-RUNBOOK.md` | Alert thresholds remain owner-dependent. |
| X6 excellence | `X6-EX-001-UI-CONSISTENCY-INVENTORY.md` | X6 safety hardening is merged. |
| X7 launch proof | `DOCS-RECONCILE-002-CURRENT-MAIN.md` | X7 Launch Evidence Pack incomplete; public launch not certified. |

## PR #871 and #868 reconciliation

PR #871 (Stripe lifecycle) and PR #868 (Vercel build stabilization) are now fully merged/integrated on main (up to PR #885).
