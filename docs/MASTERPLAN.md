# Polutek.pl Masterplan

Status: APPROVED_CANONICAL — becomes effective on repository merge
Launch Status: **NO_GO**

This is the proposed canonical entry point for the project's technical state, risk register, and ordered backlog.

## 1. Baseline State

- **Accepted Implementation Baseline SHA:** `36b57dec5c763ca29ff708c836dae0601125c49d`
  - This SHA identifies the current observed implementation including PR #902 and PR #905.
  - The implementation from PR #905 is classified as **MERGED_UNVERIFIED**.
  - No documentation file should claim to contain an eternally current Git head SHA.
- **Current Control-Plane Ticket:** `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`
- **Current Gate:** `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`
- **Current State:** `MERGED_UNVERIFIED / POST_MERGE_RECONCILIATION_REQUIRED`.
- **Next Builder Ticket:** `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001` (Verification task)

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

## 3. Vercel Evidence Record

- **Production Commit:** `36b57dec5c763ca29ff708c836dae0601125c49d` was `READY` (`VERCEL_PRODUCTION_EVIDENCE`).
- **Build Incidents:** No failed production build incident was confirmed.
- **Candidate Commit:** `36b57dec5c763ca29ff708c836dae0601125c49d` had a `READY` status.
- **Runtime Anomaly:** `HOME_CONTENT_LOAD_...` with HTTP 200 observed (`PRODUCTION_RUNTIME_EVIDENCE`). Root cause `UNPROVEN`.
- **Vercel Project Topology:** `OPERATOR_RECONCILIATION_REQUIRED`. Discrepancies noted between project locations (`polutek-pl` vs `kraufanding`).

## 4. Risk Register

| Risk ID | Title | Evidence Class | Classification | Launch Impact |
| --- | --- | --- | --- | --- |
| `EMAIL-LOCK-OWNERSHIP` | No lease ownership/fencing | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** |
| `EMAIL-LOCK-TYPE-INTEGRITY`| Takeover integrity mismatch | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** |
| `EMAIL-WEBHOOK-AUTH-FALLBACK`| Production legacy auth fallback | `REPOSITORY_EVIDENCE` | `CONFIRMED_SECURITY_GAP`| **BLOCKER** |
| `EMAIL-WEBHOOK-ERROR-DISCLOSURE`| Raw error disclosure in API | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** |
| `EMAIL-WEBHOOK-ENV-DRIFT` | Missing production env vars | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **MEDIUM** |
| `EMAIL-WEBHOOK-INTEGRATION-SKIPPED`| Critical tests skipped in CI | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** |
| `EMAIL-WEBHOOK-MIGRATION-UPGRADE`| Upgrade path unverified | `REPOSITORY_EVIDENCE` | `EVIDENCE_MISSING` | **HIGH** |
| `EMAIL-WEBHOOK-COUNTER-SEMANTICS`| Out-of-order counter drift | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **MEDIUM** |
| `EMAIL-WEBHOOK-PAYLOAD-VALIDATION`| Malformed payload processed | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** |
| `EMAIL-WEBHOOK-RETENTION` | Ledger privacy/retention gaps | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **MEDIUM** |
| `POST-MERGE-VERIFICATION-DEBT`| PR #905 merged without cert | `REPOSITORY_EVIDENCE` | `MERGED_UNVERIFIED` | **HIGH** |
| `CONTROL-PLANE-TICKET-DRIFT`| Stale current-ticket pointers | `REPOSITORY_EVIDENCE` | `FIX_REQUIRED` | **LOW** |
| `PAYMENT-WEBHOOK-FAIL` | Webhook Result Silently Ignored | `REPOSITORY_EVIDENCE` | `RESOLVED_BY_MERGED_PR` (#902) | **HISTORICAL** |
| `UNSUBSCRIBE-INSECURE`| Clear-text email in unsubscribe | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **BLOCKER** |
| `BACKUP-UNPROVEN` | Backup and restore evidence missing | `OPERATOR_EVIDENCE` | `PRODUCTION_EVIDENCE_MISSING` | **BLOCKER** |

## 5. Ordered Masterplan

### CURRENT_GATE
- **`EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`**: Independently verify merged Resend webhook implementation (`READY_FOR_CERTIFIER`).

### NEXT_CONFIRMED_TASK
- **`EMAIL-WEBHOOK-LOCK-OWNERSHIP-001`**: Add lease ownership and fencing to EmailEvent processing (`BLOCKED`).

### RECENTLY_MERGED_UNVERIFIED
- **`EMAIL-WEBHOOK-IDEMPOTENCY-001`**: `MERGED_UNVERIFIED` (PR #905)
  - merge SHA `36b57dec5c763ca29ff708c836dae0601125c49d`
  - requires post-merge verification and follow-up repairs.

### RECENTLY_COMPLETED
- **`PAYMENT-WEBHOOK-RESULT-001`**: `MERGED / HISTORICAL` (PR #902)
  - merge SHA `2c2a0f01f71e177145336051e97680bcc489e2b9`
- **`LAUNCH-EMAIL-003`**: `MERGED / ACCEPTED` (PR #899)
  - merge SHA `f7fc603183120895359e9e52464de2d01e100980`

### QUEUED_HIGH_PRIORITY (Email Repairs)
- **`EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001`**: Enforce event type integrity during takeover.
- **`EMAIL-WEBHOOK-ROUTE-SECURITY-001`**: Harden Resend webhook authentication (BLOCKER).
- **`EMAIL-WEBHOOK-ERROR-SAFETY-001`**: Prevent webhook error disclosure.
- **`EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001`**: Add event-specific payload validation.
- **`EMAIL-WEBHOOK-MIGRATION-VERIFY-001`**: Verify migration on fresh and upgraded DB.
- **`ARCH-CI-001`**: Make architecture and integration validation mandatory in CI.
- **`EMAIL-WEBHOOK-FINAL-CERT-001`**: Final Resend webhook certification (BLOCKER).

### QUEUED_HIGH_PRIORITY (General)
- **`SECURE-UNSUBSCRIBE`**: Implement signed tokens and a functional public route.
- **`SUPPRESSION-HARDENING`**: Handle bounces and complaints.
- **`ACCOUNT-DELETION-HARDENING`**: Ensure all PII and consents are cleared/anonymized.

### OPERATOR_EVIDENCE
- **`OPERATOR-EVIDENCE-PACK`**: Collect backup, restore, and provider configuration proof.

## 6. Discoverability Path

- Governance Model: [governance/BOLEK-OPERATING-MODEL.md](governance/BOLEK-OPERATING-MODEL.md)
- Core Invariants: [architecture/CORE-INVARIANTS.md](architecture/CORE-INVARIANTS.md)
- Current Ticket: [tickets/ready/README.md](tickets/ready/README.md)
- Latest Reconciliation: [reports/reconciliation/EMAIL-WEBHOOK-IDEMPOTENCY-POST-MERGE-001.md](reports/reconciliation/EMAIL-WEBHOOK-IDEMPOTENCY-POST-MERGE-001.md)
