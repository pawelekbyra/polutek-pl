# Polutek.pl Masterplan

Status: CANONICAL — ESTABLISHED 2026-06-13
Launch Status: **NO_GO**

This is the canonical entry point for the project's technical state, risk register, and ordered backlog.

## 1. Baseline State

- **Current Main SHA:** `f729c8068f681bceb28276db5899143dd3631c20`
- **Current Gate:** `LAUNCH-EMAIL-003` (Harden Email Consent Boundary)
- **Active Ticket:** `docs/tickets/ready/LAUNCH-EMAIL-003-email-consent-boundary-runtime-hardening.md`
- **Candidate Corrective Work:** `branch: launch-email-003-corrective-17820333385633550787` (Pending Review)

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

## 3. Risk Register

| Risk ID | Title | Evidence Class | Affected Invariant | Launch Impact |
| --- | --- | --- | --- | --- |
| `EMAIL-P2002` | PRISMA P2002 in Consent Sync | `VERCEL_PREVIEW` | Consent Hardening | **BLOCKER** |
| `PAYMENT-WEBHOOK-FAIL` | Webhook Result Silently Ignored | `REPOSITORY` | Access Source of Truth | **HIGH** |
| `EMAIL-WEBHOOK-IDEMP` | Resend Idempotency Ordering | `REPOSITORY` | Email Reliability | **MEDIUM** |
| `UNSUBSCRIBE-INSECURE`| Clear-text email in unsubscribe | `REPOSITORY` | Privacy/Compliance | **BLOCKER** |
| `DELETION-GAP` | Account Deletion Incomplete | `REPOSITORY` | Data Privacy | **HIGH** |
| `COPY-MISMATCH` | Terms/Privacy Mismatch | `OWNER_DECISION`| Legal Compliance | **BLOCKER** |
| `BACKUP-UNPROVEN` | Missing Backup/Restore Drill | `OPERATOR` | Reliability | **BLOCKER** |

## 4. Ordered Backlog

1. **Review & Accept `LAUNCH-EMAIL-003`** (Targeting P2002 and consent races).
2. **`PAYMENT-WEBHOOK-RESULT-001`**: Ensure Stripe webhook failures are handled and not marked as success.
3. **`EMAIL-WEBHOOK-IDEMPOTENCY-001`**: Fix Resend webhook deduplication race/ordering.
4. **`SECURE-UNSUBSCRIBE`**: Implement signed tokens and a functional public route.
5. **`SUPPRESSION-HARDENING`**: Handle bounces and complaints to protect deliverability.
6. **`ACCOUNT-DELETION-HARDENING`**: Ensure all PII and consents are cleared/anonymized.
7. **`LEGAL-COPY-SYNC`**: Align public text with owner decisions and technical inventory.
8. **`OPERATOR-EVIDENCE-PACK`**: Collect backup, restore, and provider configuration proof.

## 5. Production & Operator Evidence Gaps

The following are **NOT PROVEN** by repository code alone:
- Production environment variable completeness.
- Actual Upstash Redis usage/configuration.
- Daily backup execution and 30-day retention.
- Successful database restore drill.
- Provider (Cloudflare, Resend, Stripe) production configuration.
- Legal approval of Terms and Privacy Policy.

## 6. Discoverability Path

- Governance Model: `docs/governance/BOLEK-OPERATING-MODEL.md`
- Core Invariants: `docs/architecture/CORE-INVARIANTS.md`
- Current Ticket: `docs/tickets/ready/README.md`
- Latest Reconciliation: `docs/reports/reconciliation/BOLEK-MASTERPLAN-001.md`
