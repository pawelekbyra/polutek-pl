# Polutek.pl Masterplan

Status: **STABILIZACJA ZAKOŃCZONA / AKTYWNY PRODUKT**

This is the canonical entry point for technical state, risk register, and ordered backlog. It does not contain an eternally current Git head; read Git for current HEAD and the ready queue for execution.

## 1. Baseline State

- **Historical accepted implementation baseline SHA:** `f7fc603183120895359e9e52464de2d01e100980` through PR #899.
- **Emergency reconciliation baseline:** `6162ed6b79d412856c02c4cb5c610f4f9f81b152` through PR #929, recorded on 2026-06-17 in `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`.
- **Architecture launch-readiness audit:** `docs/reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md`.
- **Final stabilization closeout:** `docs/reports/reconciliation/POST-1026-FINAL-STABILIZATION-CLOSEOUT.md`.
- **Current executable ticket:** none; see `docs/tickets/ready/README.md` for the canonical ready-ticket queue.
- **Current state:** post-refactor active product mode.

## 2. Evidence Taxonomy

| Class | Definition |
| --- | --- |
| `REPOSITORY_EVIDENCE` | Source code, schema, and local file structure. |
| `AUTOMATED_TEST_EVIDENCE` | Results from Vitest, Playwright, GitHub Actions, or custom scripts. |
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

| Risk ID | Title | Evidence Class | Classification | Impact | Owner |
| --- | --- | --- | --- | --- | --- |
| `LARGE-REFACTOR-QUEUE` | Large refactor queue should not be reopened from old docs | `REPOSITORY_EVIDENCE` | `CLOSED` | **GREEN** | final closeout |
| `CI-SIGNAL-002` | CI/test signal correctly proves the available test suite and guard state | `AUTOMATED_TEST_EVIDENCE / REPOSITORY_EVIDENCE` | `RESOLVED` | **GREEN** | CI reconciliation |
| `STRICT-ESCAPES-DRIFT` | strict-escapes baseline/current violations are reconciled | `REPOSITORY_EVIDENCE` | `RESOLVED` | **GREEN** | CI reconciliation |
| `PAYMENTS-IDEMPOTENCY-001` | Checkout/payment idempotency has local backing | `REPOSITORY_EVIDENCE` | `MERGED` | **GREEN** | payments hardening |
| `ADMIN-AUTH-WRAPPER-CONSISTENCY` | admin route wrapper/diagnostic consistency | `REPOSITORY_EVIDENCE` | `RESOLVED_BY_PR_1008` | **GREEN** | admin diagnostics |
| `VIDEO-VIEW-IDEMPOTENCY` | duplicate view events must not double-count views | `REPOSITORY_EVIDENCE / AUTOMATED_TEST_EVIDENCE` | `RESOLVED_BY_PR_1024` | **GREEN** | video view idempotency |
| `OPERATOR-EVIDENCE` | production provider evidence, backup/restore, X6/X7 and final owner decision remain open | `OPERATOR_EVIDENCE` | `REQUIRES_OPERATOR_EVIDENCE` | **BLOCKER FOR LAUNCH** | operator launch evidence |
| `LEGAL-COPY` | Terms/privacy/cookies/support copy incomplete | `LEGAL_REVIEW` | `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING` | **BLOCKER FOR LAUNCH** | legal/operator track |

Historical risk IDs from POST-929 and POST-931 remain useful evidence but are not the current executable queue.

## 5. Ordered Masterplan

### CURRENT_GATE

- See the canonical queue: `docs/tickets/ready/README.md`.

### CURRENT_EXECUTABLE_TASK

- Brak aktywnego dużego ticketu kodowego; see `docs/tickets/ready/README.md`.

### RECENTLY_COMPLETED

- `PRODUCTION-DB-MIGRATIONS-WORKFLOW` — tooling DONE by PR #1026.
- `VIDEO-VIEW-IDEMPOTENCY-001` — DONE by PR #1024.
- `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` — DONE by PR #1008.
- `CI-SIGNAL-RECONCILIATION-002` — DONE by PR #1000.
- `COMMENTS-COUNT-SYNC-AFTER-DELETE-001` — DONE by PR #999.
- `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` — DONE by PR #998.
- `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001` — DONE by PR #994.
- `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001` — DONE by PR #990.
- `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001` — DONE before the publication/hero state-contract ticket.

### ORDERED_REPAIR_PROGRAM

1. `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` — DONE by PR #998.
2. `CI-SIGNAL-RECONCILIATION-002` — DONE by PR #1000.
3. `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` — DONE by PR #1008.
4. `VIDEO-VIEW-IDEMPOTENCY-001` — DONE by PR #1024.
5. remaining owner/operator/legal launch decisions and evidence.

### OPERATOR_EVIDENCE

- Vercel production evidence, Stripe production evidence, Cloudflare production privacy/runtime evidence, backup/restore drills, alerts, X6/X7 evidence and final owner launch decision.

### LEGAL_REVIEW

- Legal/privacy/cookies/support copy remains `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`.

## 6. Discoverability Path

- Project State: [PROJECT-STATE.md](PROJECT-STATE.md)
- Current Ticket: [tickets/ready/README.md](tickets/ready/README.md)
- Launch Backlog: [roadmap/Launch-Execution-Backlog.md](roadmap/Launch-Execution-Backlog.md)
- Final Stabilization Closeout: [reports/reconciliation/POST-1026-FINAL-STABILIZATION-CLOSEOUT.md](reports/reconciliation/POST-1026-FINAL-STABILIZATION-CLOSEOUT.md)
- Governance Model: [governance/BOLEK-OPERATING-MODEL.md](governance/BOLEK-OPERATING-MODEL.md)
- Core Invariants: [architecture/CORE-INVARIANTS.md](architecture/CORE-INVARIANTS.md)
