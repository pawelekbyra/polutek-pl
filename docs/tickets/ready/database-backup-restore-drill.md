# Ticket: database-backup-restore-drill

## Status
Status: **OPERATOR_PENDING** (Tooling implemented, operator drill pending)
Lane: Operations / Reliability
Task ID: `LAUNCH-OPS-002`

## Goal
Prepare a safe, repeatable and evidence-driven PostgreSQL backup/restore procedure for Polutek.pl, then execute as much of the drill as the available environment safely permits.

## Entry Criteria
- PostgreSQL Prisma datasource using `DATABASE_URL`.
- Standard db scripts (`db:smoke`, `db:validate`) available.

## Requirements
1. **Tooling:** Create a safe, read-only restored-database verifier (`scripts/verify-restored-database.ts`).
2. **Safety:** Verifier must refuse to run against production and redact all PII/URLs.
3. **Runbook:** Document provider-neutral restoration and verification steps (`docs/operations/database-backup-restore-drill.md`).
4. **Evidence:** Provide a structured template for drill results (`docs/operations/database-backup-restore-evidence-template.md`).
5. **Drill:** Execute the restoration drill to a temporary instance and verify (Mode A).
6. **Report:** Generate a reconciliation report summarizing readiness (Mode B if access limited).

## Execution Modes
- **Mode A (Access Available):** Complete all tooling, perform real restore, verify, and report.
- **Mode B (Access Limited):** Complete all tooling and documentation, verify tooling via tests, and report blockers for real restore.

## Validation
- Verifier script must be read-only.
- Verifier must fail if `ALLOW_RESTORE_VERIFICATION` is missing.
- Verifier must fail if `RESTORE_DATABASE_URL` matches production.
- Focused unit tests for verifier safety must pass.
- Runbook must include explicit cleanup steps.

## Definition of Done (Merge)
- [x] Safe read-only verifier script implemented.
- [x] Safety controls verified via unit tests.
- [x] Redaction of URLs and credentials in output.
- [x] Operator runbook created and verified.
- [x] Evidence template created.
- [x] Reconciliation report generated.
- [x] No production connection used automatically.
- [x] No write/destructive command introduced.

## Definition of Done (Certification)
- [ ] Restoration successfully verified with a temporary instance by an authorized operator.
- [ ] Observed RTO/RPO documented in a signed drill report.
- [ ] Cleanup of temporary target confirmed.

## Operator Access Blocker
Full execution of the drill (Mode A) requires dashboard access to the database provider to provision a temporary instance from a snapshot. In Mode B, this ticket implements all tooling and runbooks required for an owner to perform the drill autonomously.
