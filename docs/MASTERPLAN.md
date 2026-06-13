# Polutek.pl Masterplan

Status: PROPOSED_CANONICAL — becomes canonical after Bolek MERGE and repository merge
Launch Status: **NO_GO**

This is the canonical entry point for the project's technical state, risk register, and ordered backlog.

## 1. Baseline State

- **Current Main SHA:** `f729c8068f681bceb28276db5899143dd3631c20`
- **Current Control-Plane Ticket:** `LAUNCH-EMAIL-003`
- **Current Gate:** Independent review of candidate commit `3911de91e34e2b4cff6cffd8bc0583c2b9e0be45`.
- **Candidate State:** `BRANCH_WITHOUT_PR / PENDING_INDEPENDENT_REVIEW`.
- **Next Builder Ticket:** NONE until independent review of the candidate gate is complete.

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

- **Production Commit:** `f729c8068f681bceb28276db5899143dd3631c20` was `READY` (`VERCEL_PRODUCTION_EVIDENCE`).
- **Build Incidents:** No failed production build incident was confirmed.
- **Candidate Commit:** `3911de91e34e2b4cff6cffd8bc0583c2b9e0be45` had a `READY` preview (`VERCEL_PREVIEW_EVIDENCE`).
- **Runtime Anomaly:** `HOME_CONTENT_LOAD_...` with HTTP 200 observed (`PRODUCTION_RUNTIME_EVIDENCE`). Root cause `UNPROVEN`.
- **Vercel Project Topology:** `OPERATOR_RECONCILIATION_REQUIRED`. Discrepancies noted between project locations (`polutek-pl` vs `kraufanding`).

## 4. Risk Register

| Risk ID | Title | Evidence Class | Classification | Launch Impact |
| --- | --- | --- | --- | --- |
| `EMAIL-P2002` | PRISMA P2002 in Consent Sync | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **BLOCKER** |
| `PAYMENT-WEBHOOK-FAIL` | Webhook Result Silently Ignored | `REPOSITORY_EVIDENCE` | `HIGH_CONFIDENCE_CODE_FINDING` | **HIGH** |
| `EMAIL-WEBHOOK-IDEMP` | Resend Idempotency Ordering | `REPOSITORY_EVIDENCE` | `HIGH_CONFIDENCE_CODE_FINDING` | **MEDIUM** |
| `UNSUBSCRIBE-INSECURE`| Clear-text email in unsubscribe | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **BLOCKER** |
| `DELETION-GAP` | Account Deletion Incomplete | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **HIGH** |
| `COPY-MISMATCH` | Terms/Privacy Mismatch | `OWNER_DECISION`| `CONFIRMED_GAP` | **BLOCKER** |
| `BACKUP-UNPROVEN` | Missing Backup/Restore Drill | `OPERATOR_EVIDENCE` | `PRODUCTION_EVIDENCE_MISSING` | **BLOCKER** |
| `EMAIL-TEMPLATE-001` | Inactive Template Runtime | `REPOSITORY_EVIDENCE` | `REQUIRES_VERIFICATION` | **MEDIUM** |
| `PRIVACY-SYNC` | Inventory vs Copy Sync | `OWNER_DECISION` | `CONFIRMED_GAP` | **BLOCKER** |
| `PATRON-DNA-001` | Access Invariant Hardening | `REPOSITORY_EVIDENCE` | `HIGH_CONFIDENCE_CODE_FINDING` | **HIGH** |
| `RELIABILITY-001` | Missing Outbox for Side Effects | `REPOSITORY_EVIDENCE` | `HIGH_CONFIDENCE_CODE_FINDING` | **MEDIUM** |
| `DEPLOY-DNA-001` | Deployment Validation Model | `UNPROVEN` | `REQUIRES_VERIFICATION` | **MEDIUM** |
| `CONTROL-DNA-001` | Governance Traceability | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **MEDIUM** |
| `HOME-ANOMALY` | Content Load Runtime Anomaly | `PRODUCTION_RUNTIME_EVIDENCE` | `REQUIRES_VERIFICATION` | **MEDIUM** |
| `LEGACY-FALLBACK` | Allow Legacy Private Fallback | `REPOSITORY_EVIDENCE` | `REQUIRES_VERIFICATION` | **HIGH** |
| `ARCH-DEBT` | Architecture Allowlist Ledger | `REPOSITORY_EVIDENCE` | `CONFIRMED_GAP` | **LOW** |
| `PII-LOGGING` | Unredacted PII in Logs | `REPOSITORY_EVIDENCE` | `REQUIRES_VERIFICATION` | **HIGH** |
| `DATA-RETENTION` | Payload Retention Gaps | `REPOSITORY_EVIDENCE` | `REQUIRES_VERIFICATION` | **MEDIUM** |
| `PG-CONCURRENCY` | Postgres Transaction Races | `REPOSITORY_EVIDENCE` | `HIGH_CONFIDENCE_CODE_FINDING` | **MEDIUM** |

## 5. Ordered Backlog

1. **Independent Review of Candidate Gate** (Commit `3911de9`).
2. **`PAYMENT-WEBHOOK-RESULT-001`**: Ensure Stripe webhook failures are handled and not marked as success.
3. **`EMAIL-WEBHOOK-IDEMPOTENCY-001`**: Fix Resend webhook deduplication race/ordering.
4. **`SECURE-UNSUBSCRIBE`**: Implement signed tokens and a functional public route.
5. **`SUPPRESSION-HARDENING`**: Handle bounces and complaints to protect deliverability.
6. **`ACCOUNT-DELETION-HARDENING`**: Ensure all PII and consents are cleared/anonymized.
7. **`LEGAL-COPY-SYNC`**: Align public text with owner decisions and technical inventory.
8. **`OPERATOR-EVIDENCE-PACK`**: Collect backup, restore, and provider configuration proof.

## 6. Discoverability Path

- Governance Model: `docs/governance/BOLEK-OPERATING-MODEL.md`
- Core Invariants: `docs/architecture/CORE-INVARIANTS.md`
- Current Ticket: `docs/tickets/ready/README.md`
- Latest Reconciliation: `docs/reports/reconciliation/BOLEK-MASTERPLAN-001.md`
