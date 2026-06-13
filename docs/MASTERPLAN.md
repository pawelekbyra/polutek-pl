# Polutek.pl Masterplan

Status: APPROVED_CANONICAL — becomes effective on repository merge
Launch Status: **NO_GO**

This is the proposed canonical entry point for the project's technical state, risk register, and ordered backlog.

## 1. Baseline State

- **Current Main SHA:** `f7fc603183120895359e9e52464de2d01e100980`
- **Current Control-Plane Ticket:** `PAYMENT-WEBHOOK-RESULT-001`
- **Current Gate:** `PAYMENT-WEBHOOK-RESULT-001`
- **Current State:** `AUDIT_COMPLETE / READY_FOR_BUILDER`.
- **Next Builder Ticket:** `PAYMENT-WEBHOOK-RESULT-001`

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

- **Production Commit:** `f7fc603183120895359e9e52464de2d01e100980` was `READY` (`VERCEL_PRODUCTION_EVIDENCE`).
- **Build Incidents:** No failed production build incident was confirmed.
- **Candidate Commit:** `0fce5a0b2fc4bb0ae965ff16b71e95d91fcf4f6a` had a `READY` preview (`VERCEL_PREVIEW_EVIDENCE`).
- **Runtime Anomaly:** `HOME_CONTENT_LOAD_...` with HTTP 200 observed (`PRODUCTION_RUNTIME_EVIDENCE`). Root cause `UNPROVEN`.
- **Vercel Project Topology:** `OPERATOR_RECONCILIATION_REQUIRED`. Discrepancies noted between project locations (`polutek-pl` vs `kraufanding`).

## 4. Risk Register

| Risk ID | Title | Evidence Class | Classification | Launch Impact |
| --- | --- | --- | --- | --- |
| `EMAIL-P2002` | PRISMA P2002 in Consent Sync | `REPOSITORY_EVIDENCE` | `RESOLVED_BY_MERGED_PR` (#899) | **HISTORICAL BLOCKER — RESOLVED** |
| `PAYMENT-WEBHOOK-FAIL` | Webhook Result Silently Ignored | `REPOSITORY_EVIDENCE` | `AUDIT_COMPLETE / READY_FOR_BUILDER` | **HIGH** |
| `EMAIL-WEBHOOK-IDEMP` | Resend Idempotency Ordering | `REPOSITORY_EVIDENCE` | `HIGH_CONFIDENCE_CODE_FINDING` | **MEDIUM** |
| `UNSUBSCRIBE-INSECURE`| Clear-text email in unsubscribe | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **BLOCKER** |
| `DELETION-GAP` | Account Deletion Incomplete | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** |
| `COPY-MISMATCH` | Terms/Privacy Mismatch | `OWNER_DECISION`| `CONFIRMED_GAP` | **BLOCKER** |
| `BACKUP-UNPROVEN` | Backup and restore production evidence is missing | `OPERATOR_EVIDENCE` | `PRODUCTION_EVIDENCE_MISSING` | **BLOCKER** |
| `EMAIL-TEMPLATE-ACTIVE-001` | Inactive Template Runtime | `REPOSITORY_EVIDENCE` | `REQUIRES_VERIFICATION` | **MEDIUM** |
| `PRIVACY-INVENTORY-SYNC` | Inventory vs Copy Sync | `OWNER_DECISION` | `CONFIRMED_GAP` | **BLOCKER** |
| `PATRON-DNA-001` | Access Invariant Hardening | `REPOSITORY_EVIDENCE` | `HIGH_CONFIDENCE_CODE_FINDING` | **HIGH** |
| `RELIABILITY-OUTBOX-001` | Missing Outbox for Side Effects | `REPOSITORY_EVIDENCE` | `HIGH_CONFIDENCE_CODE_FINDING` | **MEDIUM** |
| `DEPLOY-DNA-001` | Deployment Validation Model | `UNPROVEN` | `REQUIRES_VERIFICATION` | **MEDIUM** |
| `CONTROL-DNA-001` | Governance Traceability | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **MEDIUM** |
| `HOME-CONTENT-RUNTIME-ANOMALY` | Content Load Runtime Anomaly | `PRODUCTION_RUNTIME_EVIDENCE` | `REQUIRES_VERIFICATION` | **MEDIUM** |
| `LEGACY-FALLBACK` | Allow Legacy Private Fallback | `REPOSITORY_EVIDENCE` | `REQUIRES_VERIFICATION` | **HIGH** |
| `ARCH-DEBT` | Architecture Allowlist Ledger | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **LOW** |
| `PII-LOGGING` | Unredacted PII in Logs | `REPOSITORY_EVIDENCE` | `REQUIRES_VERIFICATION` | **HIGH** |
| `DATA-RETENTION` | Payload Retention Gaps | `REPOSITORY_EVIDENCE` | `REQUIRES_VERIFICATION` | **MEDIUM** |
| `PG-CONCURRENCY` | Postgres Transaction Races | `REPOSITORY_EVIDENCE` | `STILL_ACTIVE / UNPROVEN` | **MEDIUM** |

## 5. Ordered Masterplan

### CURRENT_GATE
- **`PAYMENT-WEBHOOK-RESULT-001`**: Fix ignored Stripe webhook results (`AUDIT_COMPLETE / READY_FOR_BUILDER`).

### NEXT_CONFIRMED_TASK
- **`EMAIL-WEBHOOK-IDEMPOTENCY-001`**: Fix Resend webhook deduplication race/ordering (`AUDIT_REPORTED / IMPLEMENTATION_NOT_STARTED / REVALIDATION_REQUIRED`).

### RECENTLY_COMPLETED
- **`LAUNCH-EMAIL-003`**: `MERGED / ACCEPTED` (PR #899)
  - merge SHA `f7fc603183120895359e9e52464de2d01e100980`

### QUEUED_HIGH_PRIORITY
- **`SECURE-UNSUBSCRIBE`**: Implement signed tokens and a functional public route (`CONFIRMED_GAP`).
- **`SUPPRESSION-HARDENING`**: Handle bounces and complaints to protect deliverability.
- **`ACCOUNT-DELETION-HARDENING`**: Ensure all PII and consents are cleared/anonymized (`CONFIRMED_GAP`).
- **`EMAIL-TEMPLATE-ACTIVE-001`**: Address inactive template runtime usage (`REQUIRES_VERIFICATION`).
- **`PATRON-DNA-001`**: Access invariant hardening (`HIGH_CONFIDENCE_CODE_FINDING`).
- **`RELIABILITY-OUTBOX-001`**: Design and implement outbox for durable side effects (`HIGH_CONFIDENCE_CODE_FINDING`).
- **`LEGACY-FALLBACK`**: Review and potentially disable `ALLOW_LEGACY_PRIVATE_FALLBACK` (`REQUIRES_VERIFICATION`).
- **PII logging review**: Audit and harden PII redaction in logs (`REQUIRES_VERIFICATION`).

### LATER_FOUNDATION
- **`DEPLOY-DNA-001`**: Deployment validation model (`REQUIRES_VERIFICATION`).
- **`CONTROL-DNA-001`**: Governance and traceability improvements (`CONFIRMED_GAP`).
- **`HOME-CONTENT-RUNTIME-ANOMALY`**: Diagnose and resolve content load anomaly (`REQUIRES_VERIFICATION`).
- **Architecture allowlist debt ledger**: Categorize and set review dates for all check exceptions (`CONFIRMED_GAP`).
- **Retention Policy Implementation**: Webhook/inbound-email/payload retention and cleanup gaps (`REQUIRES_VERIFICATION`).
- **`PG-CONCURRENCY`**: Real-Postgres concurrency and transaction integration tests (`HIGH_CONFIDENCE_CODE_FINDING`).

### OPERATOR_EVIDENCE
- **`OPERATOR-EVIDENCE-PACK`**: Collect backup, restore, and provider configuration proof (`PRODUCTION_EVIDENCE_MISSING`).

### LEGAL_REVIEW
- **`PRIVACY-INVENTORY-SYNC`**: Align public text with owner decisions and technical inventory (`CONFIRMED_GAP`).
- **`LEGAL-COPY-SYNC`**: Align public text with professional legal review.

## 6. Discoverability Path

- Governance Model: [governance/BOLEK-OPERATING-MODEL.md](governance/BOLEK-OPERATING-MODEL.md)
- Core Invariants: [architecture/CORE-INVARIANTS.md](architecture/CORE-INVARIANTS.md)
- Current Ticket: [tickets/ready/README.md](tickets/ready/README.md)
- Latest Reconciliation: [reports/reconciliation/POST-MERGE-LAUNCH-EMAIL-003.md](reports/reconciliation/POST-MERGE-LAUNCH-EMAIL-003.md)
