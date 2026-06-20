# Polutek.pl Masterplan

Status: APPROVED_CANONICAL — ACTIVE AFTER POST-929 EMERGENCY RECONCILIATION — ROADMAP GROUPED 2026-06-20
Launch Status: **NO_GO**

This is the canonical entry point for technical state, risk register, and ordered backlog. It does not contain an eternally current Git head; read Git for current HEAD and the ready queue for execution.

## 1. Baseline State

- **Historical accepted implementation baseline SHA:** `f7fc603183120895359e9e52464de2d01e100980` through PR #899.
- **Emergency reconciliation baseline:** `6162ed6b79d412856c02c4cb5c610f4f9f81b152` through PR #929, recorded on 2026-06-17 in `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`.
- **Current executable ticket:** see `docs/tickets/ready/README.md`.
- **Current state:** resolved by the canonical ready-ticket queue, current Git history, and the latest reconciliation/closeout reports.

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

## 4. Risk Register Status

The POST-929 risk table remains valuable historical evidence, but it is no longer the executable repair queue. Several old video-provider entries were intentionally grouped and superseded by the later domain roadmap.

Current grouped code queue:

| Order | Workstream | Current state |
| ---: | --- | --- |
| 0 | Video provider lifecycle | `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001 / DONE` |
| 1 | Video state contract | `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001 / CURRENT` |
| 2 | Playback/access cleanup | `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001 / PLANNED_AFTER_VIDEO_STATE_CONTRACT` |
| 3 | Payments code hardening | `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001 / PLANNED_AFTER_PLAYBACK_ACCESS_RETIREMENT` |
| 4 | Admin auth/channel diagnostics | `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001 / PLANNED_AFTER_PAYMENTS_HARDENING` |

Risk classes still open outside the grouped code queue:

| Risk area | Current handling |
| --- | --- |
| Legal/privacy/cookies/support copy | Still `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`. |
| Production provider evidence | Vercel, Cloudflare and Stripe production evidence remain operator evidence work. |
| Backup/restore evidence | Still requires operator evidence. |
| X6/X7/final launch certification | Still open. |
| CI/quality guard maturity | Treat as process/CI hardening unless a current executable ticket says otherwise. |

## 5. Ordered Masterplan

### CURRENT_GATE

- See the canonical queue: `docs/tickets/ready/README.md`.

### CURRENT_EXECUTABLE_TASK

- `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001` via `docs/tickets/ready/README.md`.

### GROUPED_REPAIR_PROGRAM

1. `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001`
2. `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001`
3. `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001`
4. `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001`

### RECENTLY_COMPLETED

- `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001`

### HISTORICAL_OR_SUPERSEDED_PROGRAM

The older split repair program is historical and should not be used as the current execution order: `CI-SIGNAL-RESTORATION-001`, `SECURITY-DEPENDENCY-REMEDIATION-001`, `ADMIN-VIDEO-CLOUDFLARE-CONTAINMENT-001`, `CLOUDFLARE-PRODUCTION-ASSET-PRIVACY-VERIFY-001`, `ADMIN-VIDEO-TUS-UPLOAD-LIFECYCLE-001`, `ADMIN-VIDEO-PUBLICATION-AND-HERO-CONTRACT-001`, `ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001`, `ADMIN-VIDEO-POSTMERGE-VERIFY-001`, `ADMIN-AUTH-POSTMERGE-REVERIFY-001`, `LEGACY-ACCESS-POLICY-RETIREMENT-001`, `ADMIN-CHANNEL-ROOT-CAUSE-001`, `LEGACY-MEDIA-PROXY-RETIREMENT-001`, `CONTROL-PLANE-GUARD-HARDENING-001`, and `BETA-SCOPE-GUARD-RECONCILIATION-001`.

Use the grouped queue above unless a later reconciliation explicitly reactivates one of those historical cards.

### OPERATOR_EVIDENCE

- Vercel production evidence, Stripe production evidence, Cloudflare production privacy/runtime evidence, backup/restore drills, alerts.

### LEGAL_REVIEW

- Legal/privacy/cookies/support copy remains `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`.

## 6. Discoverability Path

- Governance Model: [governance/BOLEK-OPERATING-MODEL.md](governance/BOLEK-OPERATING-MODEL.md)
- Core Invariants: [architecture/CORE-INVARIANTS.md](architecture/CORE-INVARIANTS.md)
- Current Ticket: [tickets/ready/README.md](tickets/ready/README.md)
- Launch Backlog: [roadmap/Launch-Execution-Backlog.md](roadmap/Launch-Execution-Backlog.md)
- Latest Reconciliation: use the latest file in [reports/reconciliation](reports/reconciliation/); POST-929 remains historical baseline evidence.
