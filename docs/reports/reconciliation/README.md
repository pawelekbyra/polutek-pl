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

- Current global source-of-truth reconciliation: `docs/reports/reconciliation/DOCS-RECONCILE-003-OPERATOR-EVIDENCE-STATUS-CORRECTION.md`.

## Domain index

| Domain | Current canonical evidence | Historical / superseded notes |
| --- | --- | --- |
| Control plane / product standard | `DOCS-RECONCILE-003-OPERATOR-EVIDENCE-STATUS-CORRECTION.md`, `DNA-EXCELLENCE-001-PRODUCT-EXCELLENCE-AND-LAUNCH-PROOF.md` | DOCS-RECONCILE-001/002 are historical/superseded for current status semantics. |
| Payments / patron / access | `LAUNCH-FIX-007-STRIPE-REFUND-DISPUTE-PATRONGRANT-LIFECYCLE-SMOKE-TEST.md`, `X1-FIX-001-PAYMENT-ELIGIBILITY-POLICY.md`, `X2-FIX-001-CHECK-VIDEO-ACCESS-PATRONGRANT-TRUTH.md` | Stripe lifecycle merged; production evidence pending. |
| Video / playback | `X3-FIX-011-CLOUDFLARE-SIGNED-PLAYBACK-RUNTIME.md`, `LAUNCH-FIX-002-CLOUDFLARE-WEBHOOK-PRODUCTION-CHECK.md` | Signature hardening merged; live production check pending. |
| Comments | `LAUNCH-FIX-005-COMMENTS-PUBLIC-READ-PATRON-WRITE-SMOKE-TEST.md` | Implementation verified; production evidence pending. |
| Admin | `X6-FU-001-admin-access-actions-confirmation.md`, `X6-EX-001-UI-CONSISTENCY-INVENTORY.md` | Admin safety merged; usability proof pending. |
| Email / consent | `LAUNCH-EMAIL-001-EMAIL-CONSENT-UNSUBSCRIBE-SUPPRESSION-READINESS.md` | Implementation missing for unsubscribe/suppression. |
| Launch operations | `LAUNCH-FIX-001-VERCEL-PRODUCTION-ENV-VALIDATION.md`, `LAUNCH-OPS-002-DATABASE-BACKUP-RESTORE-READINESS.md` | Tooling merged; Vercel validation and restore drill pending. |
| Monitoring / incidents | `LAUNCH-OPS-003-PRODUCTION-MONITORING-AND-INCIDENT-RUNBOOK.md` | Thresholds remain owner-dependent. |
| X6 excellence | `X6-EX-001-UI-CONSISTENCY-INVENTORY.md` | X6.1 complete; X6.2–X6.8 unexecuted; X6 PARTIAL. |
| X7 launch proof | `DOCS-RECONCILE-003-OPERATOR-EVIDENCE-STATUS-CORRECTION.md` | X7 Launch Evidence Pack incomplete; `NO_GO`. |

## PR #871 and #868 reconciliation

PR #871 (Stripe lifecycle) and PR #868 (Vercel build stabilization) are now fully merged/integrated on main.
