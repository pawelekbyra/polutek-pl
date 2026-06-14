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

### Current & Future Tickets
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

### Historical Ticket List (Verified Real IDs)
1. `DNA-EXCELLENCE-001` | Product excellence proof
2. `DOCS-RECONCILE-001` | Current main truth
3. `DOCS-RECONCILE-003` | Status hotfix
4. `LAUNCH-CANDIDATE-001` | Critical path rehearsal
5. `LAUNCH-EMAIL-001` | Readiness audit
6. `LAUNCH-EMAIL-003` | Email consent boundary
7. `LAUNCH-FIX-001` | Vercel env validation
8. `LAUNCH-FIX-002` | CF webhook check
9. `LAUNCH-FIX-003` | Payment smoke test
10. `LAUNCH-FIX-004` | Video access smoke test
11. `LAUNCH-FIX-005` | Comments smoke test
12. `LAUNCH-FIX-006` | CF upload smoke test
13. `LAUNCH-FIX-007` | Lifecycle smoke test
14. `LAUNCH-LEGAL-001` | Legal readiness pack
15. `LAUNCH-SECURITY-001` | Security audit
16. `LAUNCH-SECURITY-002` | CF authenticity
17. `OWNER-LAUNCH-DECISIONS-001` | Record owner decisions
18. `PAYMENT-WEBHOOK-RESULT-001` | Fix ignored Stripe results
19. `STABILIZE-LAUNCH-BUILD-002` | Vercel build recovery
20. `X0-READY-001` | handoff inventory
21. `X0-READY-002` | Activation checklist
22. `X0-READY-003` | README slimming
23. `X0.5-READY-001` | Research synthesis
24. `X0.5-READY-002` | Decisions lock
25. `X0.5-READY-003` | Product standard
26. `X1-READY-001` | Payment inventory
27. `X2-READY-001` | Access truth inventory
28. `X3-READY-001` | Video provider inventory
29. `X4-READY-001` | PlaybackPlan inventory
30. `X5-READY-001` | Admin cockpit inventory
31. `X6-EX-001` | UI consistency inventory
32. `X6-FU-001` | Access actions confirmation
33. `X6-FU-002` | Playback messaging
34. `X7-READY-001` | Readiness gap analysis
35. `BOLEK-MASTERPLAN-001` | Masterplan establishment
36. `HOTFIX-VERCEL-001` | Vercel hotfix
37. `STABILIZE-001` | Reconcile test suite
38. `STABILIZE-X3-TYPECHECK-001` | CF Typecheck
39. `X1-FIX-001` | Eligibility policy
40. `X1-FIX-002` | Threshold defaults
41. `X1-FIX-003` | Currency scope
42. `X1-FIX-005` | Full refund revocation
43. `X2-FIX-001` | Video access check truth
44. `X2-FIX-002` | Comment write access truth
45. `X2-FIX-003` | Standardize mutations
46. `X2-FIX-004` | Admin read models
47. `X2-FIX-005` | Query sort contract
48. `X3-FIX-001` | Video asset foundation
49. `X3-FIX-002` | Gating contract
50. `X3-FIX-003` | Upload status
51. `X3-FIX-004` | Asset state
52. `X3-FIX-005` | Denied playback negative
53. `X3-FIX-006` | Storage migration plan
54. `X3-FIX-007` | Admin diagnostics
55. `X3-FIX-008` | CF Import legacy
56. `X3-FIX-009` | Disable legacy fallback
57. `X3-FIX-010` | Migration checklist
58. `X3-FIX-011` | Signed playback runtime
59. `X4-FIX-001` | Comment product contract
60. `X4-FIX-002` | Comment UI states
61. `X4-FIX-003` | Comment badge truth
62. `X4-FIX-004` | Comment negative tests

## 5. Inventory Validation
- **Inventory Row Count**: 109 (47 Current/Future + 62 Historical).
- **Exact Category Sum**: 62 (Hist) + 1 (Unv) + 1 (Ready) + 13 (Blocked) + 1 (Dec) + 31 (Plan) = 109.
- **Duplicate ID check**: PASSED.
- **Placeholder ID check**: PASSED.
- **Wildcard check**: PASSED.
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
