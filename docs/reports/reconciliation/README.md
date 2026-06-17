# Reconciliation reports

Status: `ACTIVE — POST-929 EMERGENCY CONTROL-PLANE RECONCILED FOR REVIEW`

Reconciliation reports explain how current code, tests, docs, tickets and owner decisions align at a point in time. They are evidence, not certification by themselves.

## How to read these reports

- Historical reports preserve the state and validation from the time they were written.
- Superseded reports should point to newer canonical evidence instead of rewriting old conclusions.
- Open/unmerged PR reports are not current-main truth until merged.
- Production/manual evidence must be explicitly identified; local tests and merged code are not production certification.

## Current canonical report

- Current global source-of-truth reconciliation: `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`.

## Superseded for current-state status

Earlier current-main/control-plane reports, including `POST-910-CONTROL-PLANE-RECONCILIATION.md`, remain historical point-in-time evidence only. They are superseded for current-state status by `POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`; their original findings and dates must not be rewritten as if they described later PRs.

## Domain index

| Domain | Current canonical evidence | Historical / superseded notes |
| --- | --- | --- |
| Control plane / current queue | `POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md` | POST-910 and older reports are historical for current-state status. |
| CI / quality | `POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md` | CI-SIGNAL-RESTORATION-001 is the current executable ticket. |
| Admin auth | `POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md` | PR #923 PASS is incomplete after PR #929 legacy AccessPolicy repair. |
| Admin video / Cloudflare | `POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md` | PR #926 is partial implementation, not provider/runtime verification. |
| Admin channel | `POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md` | Root cause remains unverified. |
| X7 launch proof | `DOCS-RECONCILE-003-OPERATOR-EVIDENCE-STATUS-CORRECTION.md` plus `POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md` | X7 Launch Evidence Pack incomplete; `NO_GO`. |
