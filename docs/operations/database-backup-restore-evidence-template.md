# Database Backup/Restore Drill Evidence Template

## Drill Overview

| Field | Value |
| :--- | :--- |
| **Drill ID** | `LAUNCH-OPS-002-DRILL-YYYYMMDD-HHMM` |
| **Date/Time** | YYYY-MM-DD HH:MM UTC |
| **Operator** | [Operator Name/ID] |
| **Reviewer** | [Reviewer Name/ID] |
| **Environment** | [e.g., Staging / Production Snapshot] |
| **Main SHA** | [Full Git Commit SHA] |

## Provider Capability

| Capability | Status | Evidence Reference |
| :--- | :--- | :--- |
| **Provider Name** | [Verified/Not Verified] | [Link/Description] |
| **Backup Schedule** | [Verified/Not Verified] | [Screenshot/Log] |
| **Retention Policy** | [Verified/Not Verified] | [Screenshot/Log] |
| **PITR Availability**| [Verified/Not Verified] | [Dashboard Claim] |

## Restoration Drill Execution

| Action | Timestamp (UTC) | Result/Observation |
| :--- | :--- | :--- |
| **Backup Selection** | HH:MM:SS | [ID Redacted] |
| **Restore Provisioning Start** | HH:MM:SS | |
| **Restore Provisioning End** | HH:MM:SS | |
| **Connection Setup** | HH:MM:SS | |
| **Observed RTO** | [Duration] | (End - Start) |
| **Source Data Timestamp** | YYYY-MM-DD HH:MM | [Snapshot Point] |
| **Observed RPO Window** | [Duration] | (Restore Start - Source Point) |

## Verification Results

| Category | Status | Details |
| :--- | :--- | :--- |
| **Connectivity** | [PASS/FAIL] | [Server Time Verified] |
| **Schema Status** | [PASS/FAIL] | [Migration Count Match] |
| **Migration Status** | [PASS/FAIL] | [No Failed Migrations] |
| **Integrity Status** | [PASS/FAIL] | [No Orphaned Records] |
| **Expected-Manifest Result**| [PASS/FAIL/SKIP] | [Mismatches Redacted] |
| **Application Smoke** | [PASS/FAIL/SKIP] | [Read-Only Check] |

## Cleanup Verification

- [ ] **Temporary target destroyed:** [Timestamp]
- [ ] **Credentials revoked:** [Timestamp]
- [ ] **Production unchanged:** [Confirmed]

## Blockers and Risks

- [ ] **Blockers:** [None/Description]
- [ ] **Risks:** [None/Description]

## Verdict

**VERDICT:** [PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED_NOT_EXECUTED]

---
**Note:** Never include passwords, tokens, or full connection URLs in this evidence.
