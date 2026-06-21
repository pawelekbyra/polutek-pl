# Polutek.pl Masterplan

Status: APPROVED_CANONICAL — ACTIVE AFTER POST-929 EMERGENCY RECONCILIATION — AUDIT FINDINGS ROUTED 2026-06-20
Launch Status: **NO_GO**

This is the canonical entry point for technical state, risk register, and ordered backlog. It does not contain an eternally current Git head; read Git for current HEAD and the ready queue for execution.

## 1. Baseline State

- **Historical accepted implementation baseline SHA:** `f7fc603183120895359e9e52464de2d01e100980` through PR #899.
- **Emergency reconciliation baseline:** `6162ed6b79d412856c02c4cb5c610f4f9f81b152` through PR #929, recorded on 2026-06-17 in `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`.
- **Architecture launch-readiness audit:** `docs/reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md`.
- **Current executable ticket:** see `docs/tickets/ready/README.md`.
- **Current state:** resolved by the canonical ready-ticket queue and latest reconciliation reports.

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

| Risk ID | Title | Evidence Class | Classification | Launch Impact | Owner |
| --- | --- | --- | --- | --- | --- |
| `CI-SIGNAL-002` | CI/test signal correctly proves the full available test suite and guard state | `AUTOMATED_TEST_EVIDENCE / REPOSITORY_EVIDENCE` | `RESOLVED_BY_PR_1000` | **GREEN** | `CI-SIGNAL-RECONCILIATION-002` |
| `STRICT-ESCAPES-DRIFT` | strict-escapes baseline/current violations are reconciled | `REPOSITORY_EVIDENCE` | `RESOLVED_BY_PR_1000` | **GREEN** | `CI-SIGNAL-RECONCILIATION-002` |
| `HOTSPOT-ADMIN-VIDEOS` | admin video page hotspot is split mechanically and under budget | `REPOSITORY_EVIDENCE` | `RESOLVED_BY_PR_1000` | **GREEN** | `CI-SIGNAL-RECONCILIATION-002` |
| `PAYMENTS-TRUTH-001` | Payment fulfillment validates against local Payment truth, not mutable provider metadata | `REPOSITORY_EVIDENCE` | `MERGED_IN_PR_998` | **GREEN** | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` |
| `PAYMENTS-IDEMPOTENCY-001` | Checkout request idempotency has local `(userId, requestId)` backing | `REPOSITORY_EVIDENCE` | `MERGED_IN_PR_998` | **GREEN** | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` |
| `PAYMENTS-LEGACY-SERVICE-DEADCODE` | legacy Stripe fulfillment/webhook service paths should be deleted if they still have zero production callers | `AGENT_DECLARATION / REPOSITORY_EVIDENCE` | `ROUTED_TO_LATER_CLEANUP` | **P2 FOOTGUN** | final cleanup |
| `ADMIN-AUTH-WRAPPER-CONSISTENCY` | multiple admin route wrapper idioms share one DB truth but make review harder | `AGENT_DECLARATION / REPOSITORY_EVIDENCE` | `CURRENT` | **P2 REVIEWABILITY** | `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` |
| `OPERATOR-EVIDENCE` | production provider evidence, backup/restore, X6/X7 and final owner decision remain open | `OPERATOR_EVIDENCE` | `REQUIRES_OPERATOR_EVIDENCE` | **BLOCKER** | operator launch evidence |
| `LEGAL-COPY` | Terms/privacy/cookies/support copy incomplete | `LEGAL_REVIEW` | `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING` | **BLOCKER** | legal/operator track |

Historical risk IDs from POST-929 remain useful evidence but are not the current executable queue. Completed video/provider/playback items are tracked in recent closeout reports and `docs/tickets/ready/README.md`.

## 5. Ordered Masterplan

### CURRENT_GATE

- See the canonical queue: `docs/tickets/ready/README.md`.

### CURRENT_EXECUTABLE_TASK

- `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` via `docs/tickets/ready/README.md`.

### RECENTLY_COMPLETED

- `CI-SIGNAL-RECONCILIATION-002` — DONE by PR #1000.
- `COMMENTS-COUNT-SYNC-AFTER-DELETE-001` — DONE by PR #999.
- `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` — DONE by PR #998.
- `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001` — DONE by PR #994.
- `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001` — DONE by PR #990.
- `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001` — DONE before the publication/hero state-contract ticket.

### ORDERED_REPAIR_PROGRAM

1. `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` — DONE by PR #998.
2. `CI-SIGNAL-RECONCILIATION-002` — DONE by PR #1000: CI signal restored, strict-escapes reconciled, hotspots split.
3. `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` — CURRENT: admin auth and channel diagnostics.
4. remaining non-code/operator/legal launch evidence.

### OPERATOR_EVIDENCE

- Vercel production evidence, Stripe production evidence, Cloudflare production privacy/runtime evidence, backup/restore drills, alerts, X6/X7 evidence and final owner launch decision.

### LEGAL_REVIEW

- Legal/privacy/cookies/support copy remains `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`.

## 6. Discoverability Path

- Governance Model: [governance/BOLEK-OPERATING-MODEL.md](governance/BOLEK-OPERATING-MODEL.md)
- Core Invariants: [architecture/CORE-INVARIANTS.md](architecture/CORE-INVARIANTS.md)
- Current Ticket: [tickets/ready/README.md](tickets/ready/README.md)
- Launch Backlog: [roadmap/Launch-Execution-Backlog.md](roadmap/Launch-Execution-Backlog.md)
- Architecture Launch-Readiness Audit: [reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md](reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md)
- Latest historical baseline reconciliation: [reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md](reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md)
