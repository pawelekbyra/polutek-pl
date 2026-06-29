# Polutek.pl Masterplan

Status: **STABILIZACJA ZAKOŃCZONA / AKTYWNY PRODUKT**  
Last reconciled: 2026-06-30 after PR #1259

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
| `OLD-REFACTOR-REMAINDER` | Old refactor/audit queue must not be reopened as one large task | `REPOSITORY_EVIDENCE / DOCS_RECONCILIATION` | `SMALL_REMAINDER` | **P1 control-plane** | `docs/tickets/ready/README.md` |
| `STRIPE-RECONCILIATION` | Stripe reconciliation job/cron is still missing | `REPOSITORY_EVIDENCE` | `TODO` | **P1/P2 payments ops** | `INCOMPLETE-006` |
| `LEGACY-SERVICE-CLEANUP` | Legacy service cleanup remains partial | `REPOSITORY_EVIDENCE / MERGED_PR_EVIDENCE` | `PARTIAL` | **P2 tech debt** | `CLEANUP-001` |
| `MULTI-SOURCE-E2E` | Multi-source video must work from admin create/edit through playback/player, not only schema/UI | `GITHUB_ISSUE_EVIDENCE / MERGED_PR_EVIDENCE` | `ACTIVE_PRODUCT_WORK` | **P1** | #1204 / #1228 |
| `VIDEO-PROVIDER-EXTENSIBILITY` | Mux/R2/Vimeo must not be bolted onto player/UI without provider adapters, diagnostics and security checks | `OWNER_DECISION / GITHUB_ISSUE_EVIDENCE` | `ACTIVE_PRODUCT_WORK` | **P1/P2** | #1204 / #1228 |
| `MEDIA-FALLBACKS` | Thumbnail fallback must not persist `/logo.png` as real video data and private Blob display must stay proxied | `REPOSITORY_EVIDENCE / MERGED_PR_EVIDENCE` | `MOSTLY_RESOLVED / WATCH` | **P2** | BUG-006 / PR #1256 / #1218 |
| `CAPTIONS-ACCESSIBILITY` | Per-video PL/EN captions are optional but need validated WebVTT, storage and player tracks | `GITHUB_ISSUE_EVIDENCE` | `ACTIVE_PRODUCT_WORK` | **P2** | #1219 |
| `THANK-YOU-ZONE-COPY` | Strefa Fenju / Thank You Zone should be framed as thank-you bonus, not paid content purchase | `OWNER_DECISION / REPOSITORY_EVIDENCE` | `ACTIVE_COPY_RULE` | **P1 copy** | active owner decision |
| `OPERATOR-EVIDENCE` | production provider evidence, backup/restore, X6/X7 and final owner decision remain open | `OPERATOR_EVIDENCE` | `REQUIRES_OPERATOR_EVIDENCE` | **LAUNCH BLOCKER** | operator launch evidence |
| `LEGAL-COPY` | Terms/privacy/cookies/support copy incomplete | `LEGAL_REVIEW` | `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING` | **LAUNCH BLOCKER** | legal/operator track |

Historical risk IDs from POST-929 remain useful evidence but are not the current executable queue. Completed video/provider/playback/payment/admin items are tracked in recent closeout reports and `docs/tickets/ready/README.md`.

## 5. Ordered Masterplan

### CURRENT_GATE

- Keep current HEAD buildable/deployable.
- See the canonical queue: `docs/tickets/ready/README.md`.
- Public launch remains `NO_GO` until legal/operator evidence and final owner decision say otherwise.

### CURRENT_EXECUTABLE_TASKS

Use `docs/tickets/ready/README.md` as the source of truth.

The old refactor/audit backlog currently has only two executable remainders:

1. `INCOMPLETE-006` — Stripe reconciliation job/cron.
2. `CLEANUP-001` — migrate `email.service.ts` and `lib/services/user/profile.service.ts` in small slices.

Current product/tech work is no longer described as one big refactor. It is a prioritized queue of small shippable slices:

1. P0 build/deploy fixes when main fails.
2. P1/P2 accepted product issues such as #1204/#1228/#1218/#1219.
3. P2 media/admin quality work: global default thumbnail, captions PL/EN, private Blob correctness.
4. Technical debt from `docs/REFACTORING-ROADMAP.md`, executed only in small reviewable tickets.
5. Operator/legal launch work, tracked outside code prompts unless a code defect is identified.

### RECENTLY_COMPLETED

- `CLEANUP-001` partial — PR #1259 deleted `user-access.service.ts` and `audit.service.ts`; remaining scope is `email.service.ts` and `lib/services/user/profile.service.ts`.
- `Clerk/icon/email-template production fixes` — DONE by PR #1258.
- `NAJS real surface styling` — DONE by PR #1257.
- `Thumbnail private Blob display hardening` — DONE by PR #1256.
- `INCOMPLETE-003` + `INCOMPLETE-005` — DONE by PR #1250: admin dispute sync and admin refund endpoint/UI.
- `Preferred provider upload selection` — DONE by PR #1248.
- `R2 original upload foundation` — PR #1229 was closed unmerged; do not count it as merged evidence. Later merged provider/upload evidence must come from merged PRs such as #1248.
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
- Active Execution Dashboard: [roadmap/Active-Execution-Roadmap.md](roadmap/Active-Execution-Roadmap.md)
- Owner Timeline: [roadmap/OWNER-TIMELINE.md](roadmap/OWNER-TIMELINE.md)
- Architecture Launch-Readiness Audit: [reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md](reports/reconciliation/2026-06-20-architecture-launch-readiness-audit.md)
- Latest historical baseline reconciliation: [reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md](reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md)
