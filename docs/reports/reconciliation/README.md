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

- Current global source-of-truth reconciliation: `docs/reports/reconciliation/DOCS-RECONCILE-001-CURRENT-MAIN-SOURCE-OF-TRUTH.md`.

## Domain index

| Domain | Current canonical evidence | Historical / superseded notes |
| --- | --- | --- |
| Control plane / product standard | `DOCS-RECONCILE-001-CURRENT-MAIN-SOURCE-OF-TRUTH.md`, `DNA-EXCELLENCE-001-PRODUCT-EXCELLENCE-AND-LAUNCH-PROOF.md`, `X0-READY-001-R-PHASE-HANDOFF-INVENTORY.md` | X0 activation reports are historical after current reconciliation. |
| Payments / patron / access | `X1-FIX-001-PAYMENT-ELIGIBILITY-POLICY.md`, `X1-FIX-002-LAUNCH-PAYMENT-THRESHOLD-DEFAULTS.md`, `X1-FIX-003-SUPPORTED-CURRENCIES-LAUNCH-SCOPE.md`, `X1-FIX-005-FULL-REFUND-REVOKES-LINKED-GRANT-ONLY.md`, `LAUNCH-FIX-003-PAYMENT-TO-PATRONGRANT-SMOKE-TEST.md`, `X2-FIX-001-CHECK-VIDEO-ACCESS-PATRONGRANT-TRUTH.md`, `X2-FIX-003-STANDARDIZE-PATRON-MUTATIONS-VIA-GRANTS.md` | PR #871 report is open/unmerged and not listed as current-main evidence. |
| Video / playback | `X3-FIX-001-CLOUDFLARE-STREAM-VIDEO-ASSET-FOUNDATION.md`, `X3-FIX-003-ADMIN-CLOUDFLARE-UPLOAD-AND-ASSET-STATUS.md`, `X3-FIX-004-PROVIDER-WEBHOOK-ASSET-STATE.md`, `X3-FIX-008-CLOUDFLARE-IMPORT-LEGACY-VIDEO.md`, `X3-FIX-009-DISABLE-LEGACY-PRIVATE-PLAYBACK-FALLBACK.md`, `X3-FIX-011-CLOUDFLARE-SIGNED-PLAYBACK-RUNTIME.md` | `LAUNCH-FIX-004-VIDEO-ACCESS-AND-TOKEN-LEAK-SMOKE-TEST.md` is historical for placeholder behavior before signed playback. |
| Comments | `X4-READY-001-COMMENTS-PUBLIC-READ-PATRON-WRITE-INVENTORY.md`, `X4-FIX-001-COMMENT-READ-PRODUCT-CONTRACT.md`, `X4-FIX-002-COMMENT-WRITE-ERROR-AND-EMPTY-STATES.md`, `X4-FIX-003-COMMENT-BADGE-TRUTH-HARDENING.md`, `X4-FIX-004-COMMENT-ACCESS-TRUTH-NEGATIVE-TESTS.md`, `LAUNCH-FIX-005-COMMENTS-PUBLIC-READ-PATRON-WRITE-SMOKE-TEST.md` | These `X4-*` IDs are historical comments lane IDs; current canonical X4 phase is playback/player. |
| Admin | `X3-FIX-007-LEGACY-VIDEO-INVENTORY-ADMIN-DIAGNOSTICS.md`, `X2-FIX-004-GRANT-BACKED-ADMIN-PATRON-READ-MODELS.md`, `X2-FIX-005-ADMIN-GRANT-BACKED-PATRON-QUERY-SORT-CONTRACT.md`, `LAUNCH-FIX-006-ADMIN-CLOUDFLARE-UPLOAD-IMPORT-SMOKE-TEST.md` | X5 owner usability proof remains pending. |
| Email / consent | `DOCS-RECONCILE-001-CURRENT-MAIN-SOURCE-OF-TRUTH.md` | Suppression/provider proof remains pending. |
| Launch operations | `LAUNCH-OPS-001-PRODUCTION-ENV-AND-SMOKE-TEST-INVENTORY.md`, `LAUNCH-FIX-001-VERCEL-PRODUCTION-ENV-VALIDATION.md`, `LAUNCH-FIX-002-CLOUDFLARE-WEBHOOK-PRODUCTION-CHECK.md`, `LAUNCH-FIX-006-ADMIN-CLOUDFLARE-UPLOAD-IMPORT-SMOKE-TEST.md` | Production proof must be current and redacted. |
| Monitoring / incidents | `LAUNCH-OPS-003-PRODUCTION-MONITORING-AND-INCIDENT-RUNBOOK.md` | Operational adoption and alert thresholds remain owner-dependent. |
| X6 excellence | `DNA-EXCELLENCE-001-PRODUCT-EXCELLENCE-AND-LAUNCH-PROOF.md` | X6 passes are standard-defined, not executed/certified. |
| X7 launch proof | `DNA-EXCELLENCE-001-PRODUCT-EXCELLENCE-AND-LAUNCH-PROOF.md`, `DOCS-RECONCILE-001-CURRENT-MAIN-SOURCE-OF-TRUTH.md` | X7 Launch Evidence Pack incomplete; public launch not certified. |

## Reports tied to open/unmerged PRs

- PR #871 is open/pending; any report created only on that branch is pending evidence and must not be treated as current-main truth until merge.

## Closed-unmerged PR evidence

- PR #868 is closed without merge. Its body and commit can explain historical attempted fixes, but they are not current-main implementation evidence.
