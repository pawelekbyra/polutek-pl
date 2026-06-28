# Polutek.pl Masterplan

Status: **STABILIZACJA ZAKOŃCZONA / AKTYWNY PRODUKT**

This is the canonical entry point for technical state, risk register, owner decisions and ordered product/tech backlog. It does not contain an eternally current Git head; read Git for current HEAD and the ready queue for execution.

Brak aktywnego dużego ticketu kodowego — duży refaktor jest zakończony. Pracę prowadzi się małymi izolowanymi ticketami zgodnie z `docs/tickets/ready/README.md`.

## 1. Baseline State

- **Historical accepted implementation baseline SHA:** `f7fc603183120895359e9e52464de2d01e100980` through PR #899.
- **Emergency reconciliation baseline:** `6162ed6b79d412856c02c4cb5c610f4f9f81b152` through PR #929, recorded on 2026-06-17 in `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`.
- **Architecture launch-readiness audit:** `docs/reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md`.
- **Current executable queue:** `docs/tickets/ready/README.md`.
- **Current state:** resolved by current HEAD, the canonical ready queue, active GitHub issues, and latest owner decisions.
- **Historical refactor roadmap:** `docs/REFACTORING-ROADMAP.md` remains a technical debt baseline, not the only current product roadmap.

## 2. Evidence Taxonomy

| Class | Definition |
| --- | --- |
| `REPOSITORY_EVIDENCE` | Source code, schema, and local file structure. |
| `AUTOMATED_TEST_EVIDENCE` | Results from Vitest, Playwright, or custom scripts. |
| `MERGED_PR_EVIDENCE` | A merge commit present in current history. |
| `GITHUB_ISSUE_EVIDENCE` | Current issue body/comment accepted as scoped work, especially when created or updated by owner direction. |
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

Vercel `READY` can be deployment evidence only. It is not a substitute for full GitHub CI, provider runtime verification, legal approval, X7 certification, or owner acceptance of product behavior.

A failed Vercel build is implementation evidence and must be fixed immediately before continuing non-doc product work.

## 4. Current Risk Register

| Risk ID | Title | Evidence Class | Classification | Impact | Owner |
| --- | --- | --- | --- | --- | --- |
| `BUILD-DEPLOY-HEALTH` | Main branch must build and deploy before product work is considered shippable | `VERCEL_PRODUCTION_EVIDENCE / LOCAL_BUILD_EVIDENCE` | `ACTIVE_GUARDRAIL` | **P0** | active maintainer |
| `MULTI-SOURCE-E2E` | Multi-source video must work from admin create/edit through playback/player, not only schema/UI | `GITHUB_ISSUE_EVIDENCE` | `ACTIVE_PRODUCT_WORK` | **P1** | #1204 |
| `VIDEO-PROVIDER-EXTENSIBILITY` | Mux/R2/Vimeo must not be bolted onto player/UI without provider adapters, diagnostics and security checks | `OWNER_DECISION / GITHUB_ISSUE_EVIDENCE` | `ACTIVE_PRODUCT_WORK` | **P1/P2** | #1204 |
| `MEDIA-FALLBACKS` | Thumbnail fallback must not persist `/logo.png` as real video data and should support admin-managed default thumbnail | `REPOSITORY_EVIDENCE / GITHUB_ISSUE_EVIDENCE` | `ACTIVE_PRODUCT_WORK` | **P2** | BUG-006 / #1218 |
| `CAPTIONS-ACCESSIBILITY` | Per-video PL/EN captions are optional but need validated WebVTT, storage and player tracks | `GITHUB_ISSUE_EVIDENCE` | `ACTIVE_PRODUCT_WORK` | **P2** | #1219 |
| `THANK-YOU-ZONE-COPY` | Strefa Fenju / Thank You Zone should be framed as thank-you bonus, not paid content purchase | `OWNER_DECISION / REPOSITORY_EVIDENCE` | `ACTIVE_COPY_RULE` | **P1 copy** | active owner decision |
| `CI-SIGNAL-002` | CI/test signal correctly proves the full available test suite and guard state | `AUTOMATED_TEST_EVIDENCE / REPOSITORY_EVIDENCE` | `RESOLVED_BY_PR_1000` | **GREEN** | `CI-SIGNAL-RECONCILIATION-002` |
| `STRICT-ESCAPES-DRIFT` | strict-escapes baseline/current violations are reconciled | `REPOSITORY_EVIDENCE` | `RESOLVED_BY_PR_1000` | **GREEN** | `CI-SIGNAL-RECONCILIATION-002` |
| `HOTSPOT-ADMIN-VIDEOS` | admin video page hotspot is split mechanically and under budget | `REPOSITORY_EVIDENCE` | `RESOLVED_BY_PR_1000` | **GREEN** | `CI-SIGNAL-RECONCILIATION-002` |
| `PAYMENTS-TRUTH-001` | Payment fulfillment validates against local Payment truth, not mutable provider metadata | `REPOSITORY_EVIDENCE` | `MERGED_IN_PR_998` | **GREEN** | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` |
| `PAYMENTS-IDEMPOTENCY-001` | Checkout request idempotency has local `(userId, requestId)` backing | `REPOSITORY_EVIDENCE` | `MERGED_IN_PR_998` | **GREEN** | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` |
| `PAYMENTS-WEBHOOK-SEMANTICS` | Stripe webhook route distinguishes verification/client errors from post-verification processing failures | `MERGED_PR_EVIDENCE` | `RESOLVED_BY_PR_1029` | **GREEN** | `PAYMENT-WEBHOOK-ROUTE-FAILURE-SEMANTICS-001` |
| `VIDEO-VIEW-COUNTER-CLOUDFLARE-IFRAME` | Cloudflare iframe playback can still report watched progress through a fallback timer | `MERGED_PR_EVIDENCE` | `RESOLVED_BY_PR_1033` | **GREEN** | `VIDEO-VIEW-COUNTER-CLOUDFLARE-IFRAME-001` |
| `PAYMENTS-LEGACY-SERVICE-DEADCODE` | legacy Stripe fulfillment/webhook service paths should be deleted if they still have zero production callers | `AGENT_DECLARATION / REPOSITORY_EVIDENCE` | `ROUTED_TO_LATER_CLEANUP` | **P2 FOOTGUN** | final cleanup |
| `ADMIN-AUTH-WRAPPER-CONSISTENCY` | multiple admin route wrapper idioms share one DB truth but make review harder | `MERGED_PR_EVIDENCE` | `RESOLVED_BY_PR_1008` | **GREEN** | `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` |
| `OPERATOR-EVIDENCE` | production provider evidence, backup/restore, X6/X7 and final owner decision remain open | `OPERATOR_EVIDENCE` | `REQUIRES_OPERATOR_EVIDENCE` | **LAUNCH BLOCKER** | operator launch evidence |
| `LEGAL-COPY` | Terms/privacy/cookies/support copy incomplete | `LEGAL_REVIEW` | `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING` | **LAUNCH BLOCKER** | legal/operator track |

Historical risk IDs from POST-929 remain useful evidence but are not the current executable queue. Completed video/provider/playback items are tracked in recent closeout reports and `docs/tickets/ready/README.md`.

## 5. Ordered Masterplan

### CURRENT_GATE

- Keep current HEAD buildable/deployable.
- See the canonical queue: `docs/tickets/ready/README.md`.
- Public launch remains `NO_GO` until legal/operator evidence and final owner decision say otherwise.

### CURRENT_EXECUTABLE_TASKS

Use `docs/tickets/ready/README.md` as the source of truth.

Current product/tech work is no longer described as one big refactor. It is a prioritized queue of small shippable slices:

1. P0 build/deploy fixes when main fails.
2. P1 multi-source video completion (#1204).
3. P1/P2 provider extensibility and playback safety, especially Mux/R2/Vimeo under #1204.
4. P2 media/admin quality work: global default thumbnail (#1218), captions PL/EN (#1219), private Blob correctness.
5. Technical debt from `docs/REFACTORING-ROADMAP.md`, executed only in small reviewable tickets.
6. Operator/legal launch work, tracked outside code prompts unless a code defect is identified.

### RECENTLY_COMPLETED

- `ADMIN-EMAIL-HTML-PREVIEW-SANITIZE-001` — DONE by PR #1049 and PR #1050.
- `ADMIN-EMAIL-BROADCAST-UX-CONSISTENCY-001` — DONE by PR #1042.
- `VIDEO-VIEW-COUNTER-CLOUDFLARE-IFRAME-001` — DONE by PR #1033.
- `PAYMENT-WEBHOOK-ROUTE-FAILURE-SEMANTICS-001` — DONE by PR #1029.
- `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` — DONE by PR #1008.
- `CI-SIGNAL-RECONCILIATION-002` — DONE by PR #1000.
- `COMMENTS-COUNT-SYNC-AFTER-DELETE-001` — DONE by PR #999.
- `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001` — DONE by PR #998.
- `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001` — DONE by PR #994.
- `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001` — DONE by PR #990.
- `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001` — DONE before the publication/hero state-contract ticket.

### OPERATOR_EVIDENCE

- Vercel production evidence, Stripe production evidence, Cloudflare production privacy/runtime evidence, backup/restore drills, alerts, X6/X7 evidence and final owner launch decision.

### LEGAL_REVIEW

- Legal/privacy/cookies/support copy remains `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`.
- Product copy must avoid representing Strefa Fenju / Thank You Zone as a direct purchase of paid content. It is a thank-you bonus for support/tips.

## 6. Discoverability Path

- Governance Model: [governance/BOLEK-OPERATING-MODEL.md](governance/BOLEK-OPERATING-MODEL.md)
- Core Invariants: [architecture/CORE-INVARIANTS.md](architecture/CORE-INVARIANTS.md)
- Current Queue: [tickets/ready/README.md](tickets/ready/README.md)
- Refactoring Debt Baseline: [REFACTORING-ROADMAP.md](REFACTORING-ROADMAP.md)
- Launch Backlog: [roadmap/Launch-Execution-Backlog.md](roadmap/Launch-Execution-Backlog.md)
- Architecture Launch-Readiness Audit: [reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md](reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md)
- Latest historical baseline reconciliation: [reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md](reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md)
