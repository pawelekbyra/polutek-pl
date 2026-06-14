# Polutek.pl Masterplan

Status: APPROVED_CANONICAL — becomes effective on repository merge
Launch Status: **NO_GO**

This document is the canonical entry point for technical state, risk register, and ordered backlog.

## 1. Baseline State

- **Current Observed Main HEAD:** `36b57dec5c763ca29ff708c836dae0601125c49d`
- **Last Merged Implementation:** PR #905 (Email Webhook Idempotency Hardening)
- **Verification State:** MERGED_UNVERIFIED (PR #905). PR #902 ancestry is VERIFIED.
- **Current Execution Gate:** `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`
- **Current State:** `POST_MERGE_RECONCILIATION / READY_FOR_CERTIFIER`.
- **Next Builder Ticket:** `BLOCKED_PENDING_EMAIL_WEBHOOK_POSTMERGE_VERIFICATION`

## 2. Evidence Taxonomy

| Class | Definition |
| --- | --- |
| `REPOSITORY_EVIDENCE` | Source code, schema, and local file structure. |
| `AUTOMATED_TEST_EVIDENCE` | Results from Vitest, Playwright, or custom scripts. |
| `AGENT_DECLARATION` | A statement from an AI agent (unverified until checked). |
| `LOCAL_BUILD_EVIDENCE` | Results of `npm run build` in the local environment. |
| `VERCEL_PREVIEW_EVIDENCE` | Observations from a Vercel Preview deployment. |
| `VERCEL_PRODUCTION_EVIDENCE`| Observations from the Vercel Production deployment. |
| `PRODUCTION_RUNTIME_EVIDENCE`| Logs or behavior observed in the live production environment. |
| `OPERATOR_EVIDENCE` | Redacted screenshots or confirmation from Paweł (Operator). |
| `EXTERNAL_BEST_PRACTICE` | Deep Research results or industry standards. |
| `OWNER_DECISION` | Explicit product/business decisions from Paweł. |
| `LEGAL_REVIEW` | Formal approval from a professional legal review. |
| `UNPROVEN` | A claim without supporting evidence. |
| `STALE` | Evidence that is no longer current. |

## 3. Progress Counts

### A. EXECUTION TICKET COUNTS
- **IMPLEMENTED_VERIFIED / HISTORICAL**: 62
- **MERGED_UNVERIFIED**: 1
- **READY**: 1
- **BLOCKED**: 13
- **DECISION_REQUIRED**: 1
- **PLANNED / TICKET_DETAIL_PENDING**: 31
- **Total Unique Ticket IDs**: 109

### B. LAUNCH STAGE COUNTS
- **COMPLETED**: 5
- **PARTIAL / IN_PROGRESS**: 2
- **OPEN / NOT_STARTED**: 17
- **BLOCKED**: 0
- **Total Launch Stages**: 24

*Note: The category sum equals the exact unique ticket count. Categories are mutually exclusive.*

## 4. Canonical Ticket Inventory

| Ticket ID | Title | Category | Status | Location | Dependency | Impact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001` | Post-merge verification | READY | `READY_FOR_CERTIFIER` | `ready/` | None | **BLOCKER** |
| `EMAIL-WEBHOOK-IDEMPOTENCY-001` | Resend Hardening Pass 1 | MERGED_UNVERIFIED | `MERGED_UNVERIFIED` | `ready/` | PR #905 | **BLOCKER** |
| `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001` | Add lease ownership | BLOCKED | `CONFIRMED_GAP` | `blocked/` | Verify-001 | **BLOCKER** |
| `EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001` | Event type integrity | BLOCKED | `CONFIRMED_GAP` | `blocked/` | Ownership-001 | **HIGH** |
| `EMAIL-WEBHOOK-ROUTE-SECURITY-001` | Svix Prod Enforcement | BLOCKED | `CONFIRMED_GAP` | `blocked/` | Verify-001 | **BLOCKER** |
| `EMAIL-WEBHOOK-ERROR-SAFETY-001` | Prevent disclosure | BLOCKED | `CONFIRMED_GAP` | `blocked/` | Verify-001 | **HIGH** |
| `EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001` | Per-event schema | BLOCKED | `CONFIRMED_GAP` | `blocked/` | Verify-001 | **HIGH** |
| `EMAIL-WEBHOOK-MIGRATION-VERIFY-001` | Verify legacy upgrade | BLOCKED | `EVIDENCE_MISSING` | `blocked/` | Verify-001 | **HIGH** |
| `EMAIL-WEBHOOK-COUNTER-SEMANTICS-001` | Define aggregate counters | DECISION_REQUIRED | `DECISION_REQUIRED` | `blocked/` | Verify-001 | **MEDIUM** |
| `EMAIL-WEBHOOK-PRIVACY-RETENTION-001` | Minimize PII | BLOCKED | `PARTIAL` | `blocked/` | Verify-001 | **MEDIUM** |
| `ARCH-CI-001` | CI Guard Enforcement | BLOCKED | `CONFIRMED_GAP` | `blocked/` | None | **HIGH** |
| `EMAIL-WEBHOOK-FINAL-CERT-001` | Final email cert | BLOCKED | `BLOCKED` | `blocked/` | All repairs | **BLOCKER** |
| `LAUNCH-EMAIL-002` | Secure unsubscribe | BLOCKED | `OPEN` | `blocked/` | Stage 1 | **BLOCKER** |
| `LAUNCH-BLOCKED-001` | Legal/Privacy copy | BLOCKED | `BLOCKED` | `blocked/` | Legal Review | **BLOCKER** |
| `LAUNCH-BLOCKED-002` | CF cost/retention | BLOCKED | `BLOCKED` | `blocked/` | Operator | **HIGH** |
| `LAUNCH-LEGAL-002` | Approve legal copy | BLOCKED | `BLOCKED` | `blocked/` | Legal Review | **BLOCKER** |
| `ARCH-ADMIN-AUTH-001` | Canonical admin auth | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | None | **BLOCKER** |
| `ARCH-ACCESS-001` | Explicit AccessDecision | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | None | **BLOCKER** |
| `ARCH-PLAYBACK-001` | Strict PlaybackPlan | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Access-001 | **BLOCKER** |
| `ARCH-PLAYBACK-002` | Remove READY inconsistencies | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Playback-001 | **HIGH** |
| `ARCH-CACHE-001` | Sensitive caching | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | None | **HIGH** |
| `ARCH-PATRON-001` | Audit grant creation | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Access-001 | **HIGH** |
| `ARCH-PATRON-002` | Suspend/reactivate lifecycle | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Patron-001 | **HIGH** |
| `ARCH-PATRON-003` | Refund linked grant only | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Patron-001 | **HIGH** |
| `ARCH-CLERK-001` | Durable Clerk sync | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | None | **HIGH** |
| `ARCH-PAYMENT-001` | Explicit fulfillment rules | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Patron-001 | **HIGH** |
| `ARCH-LOG-001` | Log sanitization | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | None | **HIGH** |
| `ARCH-E2E-001` | Denied playback tests | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Playback-002 | **HIGH** |
| `ARCH-COMMENTS-001` | Canonical comments policy | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Access-001 | **MEDIUM** |
| `ARCH-DI-001` | Decide AppContext boundary | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | None | **MEDIUM** |
| `ARCH-DI-002` | Migrate Access to Ports | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | DI-001 | **MEDIUM** |
| `ARCH-DI-003` | Inject Playback Provider | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | DI-001 | **MEDIUM** |
| `ARCH-DI-004` | Inject Stripe dependencies | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | DI-001 | **MEDIUM** |
| `ARCH-ADMIN-001` | Complete Access Diagnostics | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Access-001 | **MEDIUM** |
| `ARCH-ADMIN-002` | Expose Admin Override | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Access-001 | **MEDIUM** |
| `ARCH-GUARD-001` | Forbidden auth-source rules | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | CI-001 | **MEDIUM** |
| `ARCH-TEST-001` | Complete access matrix | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | P0 repairs | **MEDIUM** |
| `ARCH-COVERAGE-001` | Critical-domain coverage | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | CI-001 | **MEDIUM** |
| `ARCH-LEGACY-001` | Remove PlaybackService dep | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | P0 repairs | **LOW** |
| `ARCH-LEGACY-002` | Remove UserAccessService dep | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Access-001 | **LOW** |
| `ARCH-LEGACY-003` | Replace ChannelLayout bridge | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | DI-001 | **LOW** |
| `ARCH-LEGACY-004` | Move Admin Query Parser | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | None | **LOW** |
| `ARCH-LEGACY-005` | Remove Email Service bridge | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | Email repairs | **LOW** |
| `ARCH-LEGACY-006` | Remove Storage Service bridge | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | DI-003 | **LOW** |
| `ARCH-LEGACY-007` | Remove User Profile bridge | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | None | **LOW** |
| `ARCH-GUARD-002` | AST/Dependency Graph | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | CI-001 | **LOW** |
| `ARCH-DOCS-001` | Final reconciliation | PLANNED | `TICKET_DETAIL_PENDING` | Backlog | All repairs | **LOW** |
| `DNA-EXCELLENCE-001` | Product excellence proof | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `DOCS-RECONCILE-001` | Current main truth | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `DOCS-RECONCILE-003` | Status hotfix | HISTORICAL | `VERIFIED` | `ready/` | PR | **HIGH** |
| `LAUNCH-CANDIDATE-001` | Critical path rehearsal | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `LAUNCH-EMAIL-001` | Readiness audit | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `LAUNCH-EMAIL-003` | Email consent boundary | HISTORICAL | `VERIFIED` | `ready/` | PR #899 | **BLOCKER** |
| `LAUNCH-FIX-001` | Vercel env validation | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `LAUNCH-FIX-002` | CF webhook check | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `LAUNCH-FIX-003` | Payment smoke test | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `LAUNCH-FIX-004` | Video access smoke test | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `LAUNCH-FIX-005` | Comments smoke test | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `LAUNCH-FIX-006` | CF upload smoke test | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `LAUNCH-FIX-007` | Lifecycle smoke test | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `LAUNCH-LEGAL-001` | Legal readiness pack | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `LAUNCH-SECURITY-001` | Security audit | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `LAUNCH-SECURITY-002` | CF authenticity | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `OWNER-LAUNCH-DECISIONS-001` | Record owner decisions | HISTORICAL | `VERIFIED` | `ready/` | PR #890 | **BLOCKER** |
| `PAYMENT-WEBHOOK-RESULT-001` | Fix ignored Stripe results | HISTORICAL | `VERIFIED` | `ready/` | PR #902 | **HIGH** |
| `STABILIZE-LAUNCH-BUILD-002` | Vercel build recovery | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X0-READY-001` | handoff inventory | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X0-READY-002` | Activation checklist | HISTORICAL | `VERIFIED` | `done/`  | PR | **BLOCKER** |
| `X0-READY-003` | README slimming | HISTORICAL | `VERIFIED` | `done/`  | PR | **BLOCKER** |
| `X0.5-READY-001` | Research synthesis | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X0.5-READY-002` | Decisions lock | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X0.5-READY-003` | Product standard | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X1-READY-001` | Payment inventory | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X2-READY-001` | Access truth inventory | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X3-READY-001` | Video provider inventory | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X4-READY-001` | PlaybackPlan inventory | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X5-READY-001` | Admin cockpit inventory | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X6-EX-001` | UI consistency inventory | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X6-FU-001` | Access actions confirmation | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X6-FU-002` | Playback messaging | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X7-READY-001` | Readiness gap analysis | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `BOLEK-MASTERPLAN-001` | Masterplan establishment | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `HOTFIX-VERCEL-001` | Vercel hotfix | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `STABILIZE-001` | Reconcile test suite | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `STABILIZE-X3-TYPECHECK-001` | CF Typecheck | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X1-FIX-001` | Eligibility policy | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X1-FIX-002` | Threshold defaults | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X1-FIX-003` | Currency scope | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X1-FIX-005` | Full refund revocation | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X2-FIX-001` | Video access check truth | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X2-FIX-002` | Comment write access truth | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X2-FIX-003` | Standardize mutations | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X2-FIX-004` | Admin read models | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X2-FIX-005` | Query sort contract | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X3-FIX-001` | Video asset foundation | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X3-FIX-002` | Gating contract | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X3-FIX-003` | Upload status | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X3-FIX-004` | Asset state | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X3-FIX-005` | Denied playback negative | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X3-FIX-006` | Storage migration plan | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X3-FIX-007` | Admin diagnostics | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X3-FIX-008` | CF Import legacy | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X3-FIX-009` | Disable legacy fallback | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X3-FIX-010` | Migration checklist | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X3-FIX-011` | Signed playback runtime | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X4-FIX-001` | Comment product contract | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X4-FIX-002` | Comment UI states | HISTORICAL | `VERIFIED` | `ready/` | PR | **BLOCKER** |
| `X4-FIX-003` | Comment badge truth | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |
| `X4-FIX-004` | Comment negative tests | HISTORICAL | `VERIFIED` | `reports/`| PR | **BLOCKER** |

## 5. Inventory Validation
- **Inventory Row Count**: 109 (47 Current/Future + 62 Historical).
- **Exact Category Sum**: 62 (Hist) + 1 (Unv) + 1 (Ready) + 13 (Blocked) + 1 (Dec) + 31 (Plan) = 109.
- **Duplicate ID check**: PASSED.
- **Placeholder ID check**: PASSED (No synthetic HIST-nn).
- **Wildcard check**: PASSED (Enumerated only).
- **Missing referenced ID check**: PASSED.

## 6. Risk Register

### Email & Webhook Risks
| Risk ID | Title | Classification | Launch Impact | Ticket |
| --- | --- | --- | --- | --- |
| `EMAIL-LOCK-OWNERSHIP` | Missing lease ownership/fencing | `CONFIRMED_GAP` | **HIGH** | `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001` |
| `EMAIL-LOCK-TYPE-INTEGRITY`| Event type integrity during takeover | `CONFIRMED_GAP` | **HIGH** | `EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001` |
| `EMAIL-WEBHOOK-AUTH-FALLBACK` | Production legacy auth fallback | `CONFIRMED_SECURITY_GAP`| **BLOCKER** | `EMAIL-WEBHOOK-ROUTE-SECURITY-001` |
| `EMAIL-WEBHOOK-ERROR-DISCLOSURE`| Internal error/secret disclosure | `CONFIRMED_GAP` | **HIGH** | `EMAIL-WEBHOOK-ERROR-SAFETY-001` |
| `EMAIL-WEBHOOK-ENV-DRIFT` | Missing production env variables | `CONFIRMED_GAP` | **HIGH** | `EMAIL-WEBHOOK-ROUTE-SECURITY-001` |
| `EMAIL-WEBHOOK-INTEGRATION-SKIPPED`| Skipped integration tests in CI | `EVIDENCE_MISSING` | **HIGH** | `ARCH-CI-001` |
| `EMAIL-WEBHOOK-MIGRATION-UPGRADE` | Unverified upgrade migration | `EVIDENCE_MISSING` | **HIGH** | `EMAIL-WEBHOOK-MIGRATION-VERIFY-001` |
| `EMAIL-WEBHOOK-COUNTER-SEMANTICS` | Ambiguous broadcast counters | `DECISION_REQUIRED` | **MEDIUM** | `EMAIL-WEBHOOK-COUNTER-SEMANTICS-001` |
| `EMAIL-WEBHOOK-PAYLOAD-VALIDATION`| Missing per-event validation | `CONFIRMED_GAP` | **HIGH** | `EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001` |
| `EMAIL-WEBHOOK-RETENTION` | Payload privacy and retention | `CONFIRMED_GAP` | **MEDIUM** | `EMAIL-WEBHOOK-PRIVACY-RETENTION-001` |
| `POST-MERGE-VERIFICATION-DEBT` | PR #905 merged without cert | `MERGED_UNVERIFIED` | **HIGH** | `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001` |
| `CONTROL-PLANE-TICKET-DRIFT` | Ticket and queue drift | `CONFIRMED_GAP` | **HIGH** | `ARCH-DOCS-001` |

### Architecture Risks (P0 - Launch/Security Correctness)
| Risk ID | Title | Classification | Launch Impact | Ticket |
| --- | --- | --- | --- | --- |
| `ADMIN-AUTHORITY-DRIFT` | Fragmented admin resolver | `CONFIRMED_GAP` | **BLOCKER** | `ARCH-ADMIN-AUTH-001` |
| `ACCESS-DECISION-CONTRACT` | Non-canonical authorization | `CONFIRMED_GAP` | **BLOCKER** | `ARCH-ACCESS-001` |
| `PATRON-CACHE-DRIFT` | `User.isPatron` drift | `CONFIRMED_GAP` | **MEDIUM** | `ARCH-ACCESS-001` |
| `CLERK-DURABLE-REPAIR` | Clerk sync failure handling | `CONFIRMED_GAP` | **HIGH** | `ARCH-CLERK-001` |
| `PATRON-LIFECYCLE-INCOMPLETE` | Missing SUSPENDED state | `CONFIRMED_GAP` | **HIGH** | `ARCH-PATRON-002` |
| `AUDIT-COMPLETENESS` | Missing domain audit events | `CONFIRMED_GAP` | **HIGH** | `ARCH-PATRON-001` |
| `PAYMENT-ELIGIBILITY-BOUNDARY` | Implicit fulfillment rules | `CONFIRMED_GAP` | **HIGH** | `ARCH-PAYMENT-001` |
| `PLAYBACK-READY-SEMANTICS` | READY + canPlay inconsistency | `CONFIRMED_GAP` | **BLOCKER** | `ARCH-PLAYBACK-001` |
| `SENSITIVE-CACHE` | Caching of personal responses | `CONFIRMED_GAP` | **HIGH** | `ARCH-CACHE-001` |
| `ARCH-GUARD-CI` | Missing architecture CI guard | `CONFIRMED_GAP` | **HIGH** | `ARCH-CI-001` |
| `LOG-SECRET-PII-SAFETY` | Secret/PII leakage in logs | `CONFIRMED_GAP` | **HIGH** | `ARCH-LOG-001` |
| `COMMENTS-PERMISSION-DRIFT` | Fragmented comments policy | `CONFIRMED_GAP` | **MEDIUM** | `ARCH-COMMENTS-001` |
| `DOC-CODE-QUEUE-DRIFT` | Document vs Queue mismatch | `CONFIRMED_GAP` | **HIGH** | `ARCH-DOCS-001` |

### Historical Risks (Resolved)
| Risk ID | Title | Classification | Status |
| --- | --- | --- | --- |
| `PAYMENT-WEBHOOK-FAIL` | Webhook Result Silently Ignored | `RESOLVED_BY_MERGED_PR / HISTORICAL` | PR #902 |
| `EMAIL-WEBHOOK-IDEMP` | Resend Webhook Idempotency | `MERGED_UNVERIFIED / CONFIRMED_FOLLOW_UP_GAPS`| PR #905 |
| `EMAIL-P2002` | PRISMA P2002 in Consent Sync | `RESOLVED_BY_MERGED_PR` | PR #899 |

## 7. Ordered Masterplan

### CURRENT_GATE
- **`EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`**: Independently verify merged PR #905 implementation and gaps (`READY_FOR_CERTIFIER`).

### RECENTLY_MERGED_UNVERIFIED
- **`EMAIL-WEBHOOK-IDEMPOTENCY-001`**: PR #905 (`MERGED_UNVERIFIED`).

### RECENTLY_COMPLETED
- **`PAYMENT-WEBHOOK-RESULT-001`**: PR #902 (`HISTORICAL`).
- **`LAUNCH-EMAIL-003`**: PR #899 (`MERGED`).

### QUEUED_HIGH_PRIORITY (Repairs)
1. `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001`
2. `EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001`
3. `EMAIL-WEBHOOK-ROUTE-SECURITY-001`
4. `EMAIL-WEBHOOK-ERROR-SAFETY-001`
5. `ARCH-CI-001`
6. `ARCH-ADMIN-AUTH-001`
7. `ARCH-ACCESS-001`
8. `ARCH-PLAYBACK-001`
9. `ARCH-PLAYBACK-002`
10. `ARCH-CACHE-001`
11. `ARCH-PATRON-001`
12. `ARCH-PATRON-002`
13. `ARCH-PATRON-003`
14. `ARCH-PAYMENT-001`
15. `ARCH-CLERK-001`
16. `ARCH-E2E-001`
17. `ARCH-LOG-001`
18. `ARCH-COMMENTS-001`

### ARCHITECTURAL HARDENING (P1)
- `ARCH-DI-001` to `ARCH-DI-004`, `ARCH-ADMIN-001`, `ARCH-ADMIN-002`, `ARCH-GUARD-001`, `ARCH-TEST-001`, `ARCH-COVERAGE-001`.

### LEGACY RETIREMENT (P2)
- `ARCH-LEGACY-001` to `ARCH-LEGACY-007`, `ARCH-GUARD-002`, `ARCH-DOCS-001`.

## 8. Discoverability Path

- Governance Model: [governance/BOLEK-OPERATING-MODEL.md](governance/BOLEK-OPERATING-MODEL.md)
- Architecture Repair: [architecture/ARCHITECTURE-REPAIR-PLAN.md](architecture/ARCHITECTURE-REPAIR-PLAN.md)
- Current Ticket: [tickets/ready/README.md](tickets/ready/README.md)
- Latest Reconciliation: [reports/reconciliation/EMAIL-WEBHOOK-IDEMPOTENCY-POST-MERGE-001.md](reports/reconciliation/EMAIL-WEBHOOK-IDEMPOTENCY-POST-MERGE-001.md)
