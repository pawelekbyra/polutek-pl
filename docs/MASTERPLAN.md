# Polutek.pl Masterplan

Status: APPROVED_CANONICAL — ACTIVE AFTER POST-929 EMERGENCY RECONCILIATION
Launch Status: **NO_GO**

This is the canonical entry point for technical state, risk register, and ordered backlog. It does not contain an eternally current Git head; read Git for current HEAD and the ready queue for execution.

## 1. Baseline State

- **Historical accepted implementation baseline SHA:** `f7fc603183120895359e9e52464de2d01e100980` through PR #899.
- **Emergency reconciliation baseline:** `6162ed6b79d412856c02c4cb5c610f4f9f81b152` through PR #929, recorded on 2026-06-17 in `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`.
- **Current executable ticket:** see `docs/tickets/ready/README.md`.
- **Current state:** resolved by the canonical ready-ticket queue and the latest reconciliation report.

## 2. Evidence Taxonomy

| Class | Definition |
| --- | --- |
| `REPOSITORY_EVIDENCE` | Source code, schema, and local file structure. |
| `AUTOMATED_TEST_EVIDENCE` | Results from Vitest, Playwright, or custom scripts. |
| `MERGED_PR_EVIDENCE` | A merge commit present in current history. |
| `AGENT_DECLARATION` | A statement from an AI agent; unverified until checked. |
| `LOCAL_BUILD_EVIDENCE` | Results of local build commands. |
| `VERCEL_PREVIEW_EVIDENCE` | Vercel Preview observations. |
| `VERCEL_PRODUCTION_EVIDENCE` | Vercel Production deployment observations; not full CI evidence. |
| `PRODUCTION_RUNTIME_EVIDENCE` | Logs or behavior observed in live production. |
| `OPERATOR_EVIDENCE` | Redacted screenshots/confirmation from Paweł. |
| `OWNER_DECISION` | Explicit product/business decisions from Paweł. |
| `LEGAL_REVIEW` | Formal professional legal review. |
| `UNPROVEN` | Claim without supporting evidence. |
| `STALE` | Evidence no longer current. |

## 3. Vercel Evidence Boundary

Vercel `READY` can be deployment evidence only. It is not a substitute for full GitHub CI, provider runtime verification, legal approval, or X7 certification.

## 4. Current Risk Register

| Risk ID | Title | Evidence Class | Classification | Launch Impact |
| --- | --- | --- | --- | --- |
| `CI-001` | Last reviewed PR CI failed | `AGENT_DECLARATION / PR_EVIDENCE` | `CONFIRMED` | **P0 BLOCKER** |
| `CI-002` | strict-escapes failure skips major checks | `REPOSITORY_EVIDENCE` | `CONFIRMED` | **P0 BLOCKER** |
| `CI-003` | strict-escapes lacks historical baseline/no-new-debt mode | `REPOSITORY_EVIDENCE` | `CONFIRMED` | **P0 BLOCKER** |
| `CI-004` | architecture boundaries guard not run in CI | `REPOSITORY_EVIDENCE` | `CONFIRMED` | **P0 BLOCKER** |
| `CI-005` | control-plane docs guard not run in CI | `REPOSITORY_EVIDENCE` | `CONFIRMED` | **P0 BLOCKER** |
| `CI-006` | npm audit high unresolved | `AUTOMATED_TEST_EVIDENCE` | `UNRESOLVED` | **P0 BLOCKER** |
| `CI-007` | branch protection enforcement unproven | `UNPROVEN` | `REQUIRES_VERIFICATION` | **P0 BLOCKER** |
| `CI-008` | Vercel READY misused as CI substitute | `EVIDENCE_BOUNDARY` | `PROCESS_GAP` | **HIGH** |
| `ADMIN-AUTH-REVERIFY` | Auth implementation merged but full current-main certification missing | `MERGED_PR_EVIDENCE` | `REVERIFICATION_REQUIRED` | **HIGH** |
| `VIDEO-CF-001..012` | Cloudflare upload/asset lifecycle defects | `REPOSITORY_EVIDENCE` | `CORRECTIVE_WORK_REQUIRED` | **P0 BLOCKER** |
| `VIDEO-PUBLISH-001` | Publication gate incomplete | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **P0 BLOCKER** |
| `VIDEO-HERO-001` | Hero contract inconsistent | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **P0 BLOCKER** |
| `VIDEO-STATE-001` | Archive/unpublish transition policy missing | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** |
| `VIDEO-ADMIN-001..005` | Admin create/form/filter contract defects | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** |
| `VIDEO-PLAYBACK-001..002` | Media-source and legacy media contracts unreconciled | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **P0 BLOCKER** |
| `VIDEO-VERIFY-001` | Provider/E2E verification missing | `AUTOMATED_TEST_EVIDENCE / OPERATOR_EVIDENCE` | `EVIDENCE_GAP` | **P0 BLOCKER** |
| `ADMIN-CHANNEL-001` | Admin channel root cause unknown | `REPOSITORY_EVIDENCE / OPERATOR_EVIDENCE` | `ROOT_CAUSE_NOT_VERIFIED` | **HIGH** |
| `CONTROL-001..008` | Control-plane chronology, guard and evidence-boundary gaps | `REPOSITORY_EVIDENCE` | `EMERGENCY_RECONCILED / HARDENING_REQUIRED` | **HIGH** |
| `LEGAL-COPY` | Terms/privacy/cookies/support copy incomplete | `LEGAL_REVIEW` | `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING` | **BLOCKER** |
| `BACKUP-UNPROVEN` | Backup/restore evidence missing | `OPERATOR_EVIDENCE` | `PRODUCTION_EVIDENCE_MISSING` | **BLOCKER** |

Full detailed risk IDs are in `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`.

## 5. Ordered Masterplan

### CURRENT_GATE
- See the canonical queue: `docs/tickets/ready/README.md`.

### CURRENT_EXECUTABLE_TASK
- `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` via `docs/tickets/ready/README.md`.

### RECENTLY_COMPLETED
- `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001` — DONE by PR #994.
- `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001` — DONE by PR #990.
- `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001` — DONE before the publication/hero state-contract ticket.

### ORDERED_REPAIR_PROGRAM
1. `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` — CURRENT payments code hardening after playback/access cleanup.
2. `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` — admin auth and channel diagnostics after payments hardening.
3. `CONTROL-PLANE-GUARD-HARDENING-001`
4. `BETA-SCOPE-GUARD-RECONCILIATION-001`

### OPERATOR_EVIDENCE
- Vercel production evidence, Stripe production evidence, Cloudflare production privacy/runtime evidence, backup/restore drills, alerts.

### LEGAL_REVIEW
- Legal/privacy/cookies/support copy remains `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`.

## 6. Discoverability Path

- Governance Model: [governance/BOLEK-OPERATING-MODEL.md](governance/BOLEK-OPERATING-MODEL.md)
- Core Invariants: [architecture/CORE-INVARIANTS.md](architecture/CORE-INVARIANTS.md)
- Current Ticket: [tickets/ready/README.md](tickets/ready/README.md)
- Launch Backlog: [roadmap/Launch-Execution-Backlog.md](roadmap/Launch-Execution-Backlog.md)
- Latest Reconciliation: [reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md](reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md)
