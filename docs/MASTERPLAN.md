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
- **Next Builder Ticket:** [TBD after certification]

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

| Category | Counts |
| --- | --- |
| **Unique Execution Ticket IDs** | 21 IMPLEMENTED_VERIFIED/HISTORICAL, 1 MERGED_UNVERIFIED, 1 READY, 10 BLOCKED, 1 DECISION_REQUIRED |
| **Launch Stages** | 5 COMPLETED, 2 PARTIAL, 17 OPEN, 0 BLOCKED |

*Note: Ticket IDs and Launch Stages are different units and should not be compared 1:1. A single launch stage may require multiple execution tickets.*

## 4. Risk Register

### Email & Webhook Risks
| Risk ID | Title | Evidence Class | Classification | Launch Impact | Ticket |
| --- | --- | --- | --- | --- | --- |
| `EMAIL-LOCK-OWNERSHIP` | Missing lease ownership/fencing | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001` |
| `EMAIL-LOCK-TYPE-INTEGRITY`| Event type integrity during takeover | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001` |
| `EMAIL-WEBHOOK-AUTH-FALLBACK` | Production legacy auth fallback | `REPOSITORY_EVIDENCE` | `CONFIRMED_SECURITY_GAP`| **BLOCKER** | `EMAIL-WEBHOOK-ROUTE-SECURITY-001` |
| `EMAIL-WEBHOOK-ERROR-DISCLOSURE`| Internal error/secret disclosure | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `EMAIL-WEBHOOK-ERROR-SAFETY-001` |
| `EMAIL-WEBHOOK-ENV-DRIFT` | Missing production env variables | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `EMAIL-WEBHOOK-ROUTE-SECURITY-001` |
| `EMAIL-WEBHOOK-INTEGRATION-SKIPPED`| Skipped integration tests in CI | `AGENT_DECLARATION` | `EVIDENCE_MISSING` | **HIGH** | `ARCH-CI-001` |
| `EMAIL-WEBHOOK-MIGRATION-UPGRADE` | Unverified upgrade migration | `AGENT_DECLARATION` | `EVIDENCE_MISSING` | **HIGH** | `EMAIL-WEBHOOK-MIGRATION-VERIFY-001` |
| `EMAIL-WEBHOOK-COUNTER-SEMANTICS` | Ambiguous broadcast counters | `REPOSITORY_EVIDENCE` | `DECISION_REQUIRED` | **MEDIUM** | `EMAIL-WEBHOOK-COUNTER-SEMANTICS-001` |
| `EMAIL-WEBHOOK-PAYLOAD-VALIDATION`| Missing per-event validation | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001` |
| `EMAIL-WEBHOOK-RETENTION` | Payload privacy and retention | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **MEDIUM** | `EMAIL-WEBHOOK-PRIVACY-RETENTION-001` |
| `POST-MERGE-VERIFICATION-DEBT` | PR #905 merged without cert | `REPOSITORY_EVIDENCE` | `MERGED_UNVERIFIED` | **HIGH** | `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001` |
| `CONTROL-PLANE-TICKET-DRIFT` | Ticket and queue drift | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `ARCH-DOCS-001` |

### Architecture Risks
| Risk ID | Title | Evidence Class | Classification | Launch Impact | Ticket |
| --- | --- | --- | --- | --- | --- |
| `ADMIN-AUTHORITY-DRIFT` | Fragmented admin resolver | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `ARCH-ADMIN-AUTH-001` |
| `ACCESS-DECISION-CONTRACT` | Non-canonical authorization | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `ARCH-ACCESS-001` |
| `PATRON-CACHE-DRIFT` | `User.isPatron` drift | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **MEDIUM** | `ARCH-ACCESS-001` |
| `CLERK-DURABLE-REPAIR` | Clerk sync failure handling | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `ARCH-CLERK-001` |
| `PATRON-LIFECYCLE-INCOMPLETE` | Missing SUSPENDED state | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `ARCH-PATRON-002` |
| `AUDIT-COMPLETENESS` | Missing domain audit events | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `ARCH-PATRON-001` |
| `PAYMENT-ELIGIBILITY-BOUNDARY` | Implicit fulfillment rules | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `ARCH-PAYMENT-001` |
| `PLAYBACK-READY-SEMANTICS` | READY + canPlay inconsistency | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `ARCH-PLAYBACK-001` |
| `SENSITIVE-CACHE` | Caching of personal responses | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `ARCH-CACHE-001` |
| `APP-CONTEXT-PRISMA-BOUNDARY` | Direct Prisma in application | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **MEDIUM** | `ARCH-DI-001` |
| `ARCH-GUARD-CI` | Missing architecture CI guard | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `ARCH-CI-001` |
| `LEGACY-SERVICE-RETIREMENT` | Active `lib/services/` | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **LOW** | `ARCH-LEGACY-*` |
| `LOG-SECRET-PII-SAFETY` | Secret/PII leakage in logs | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** | `ARCH-LOG-001` |
| `COMMENTS-PERMISSION-DRIFT` | Fragmented comments policy | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **MEDIUM** | `ARCH-COMMENTS-001` |

### Historical Risks (Resolved)
| Risk ID | Title | Evidence Class | Classification | Status |
| --- | --- | --- | --- | --- |
| `PAYMENT-WEBHOOK-FAIL` | Webhook Result Silently Ignored | `REPOSITORY_EVIDENCE` | `RESOLVED_BY_MERGED_PR / HISTORICAL` | PR #902 |
| `EMAIL-WEBHOOK-IDEMP` | Resend Webhook Idempotency | `REPOSITORY_EVIDENCE` | `MERGED_UNVERIFIED / CONFIRMED_FOLLOW_UP_GAPS`| PR #905 |
| `EMAIL-P2002` | PRISMA P2002 in Consent Sync | `REPOSITORY_EVIDENCE` | `RESOLVED_BY_MERGED_PR` | PR #899 |

## 5. Ordered Masterplan

### CURRENT_GATE
- **`EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`**: Independently verify merged PR #905 implementation and gaps (`READY_FOR_CERTIFIER`).

### RECENTLY_MERGED_UNVERIFIED
- **`EMAIL-WEBHOOK-IDEMPOTENCY-001`**: PR #905 (MERGED_UNVERIFIED).

### RECENTLY_COMPLETED
- **`PAYMENT-WEBHOOK-RESULT-001`**: PR #902 (HISTORICAL).
- **`LAUNCH-EMAIL-003`**: PR #899 (MERGED).

### QUEUED_HIGH_PRIORITY (Repairs)
1. `EMAIL-WEBHOOK-LOCK-OWNERSHIP-001` (Blocked by verification)
2. `EMAIL-WEBHOOK-ROUTE-SECURITY-001`
3. `EMAIL-WEBHOOK-ERROR-SAFETY-001`
4. `ARCH-CI-001`
5. `ARCH-ADMIN-AUTH-001`

### ARCHITECTURE BACKLOG (P0)
- `ARCH-ACCESS-001`, `ARCH-PLAYBACK-001`, `ARCH-CACHE-001`, `ARCH-PATRON-001`, `ARCH-CLERK-001`.

## 6. Discoverability Path

- Governance Model: [governance/BOLEK-OPERATING-MODEL.md](governance/BOLEK-OPERATING-MODEL.md)
- Architecture Repair: [architecture/ARCHITECTURE-REPAIR-PLAN.md](architecture/ARCHITECTURE-REPAIR-PLAN.md)
- Current Ticket: [tickets/ready/README.md](tickets/ready/README.md)
- Latest Reconciliation: [reports/reconciliation/EMAIL-WEBHOOK-IDEMPOTENCY-POST-MERGE-001.md](reports/reconciliation/EMAIL-WEBHOOK-IDEMPOTENCY-POST-MERGE-001.md)
