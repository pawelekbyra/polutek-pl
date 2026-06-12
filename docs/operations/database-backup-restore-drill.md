# Database Backup/Restore Drill Runbook

Status: **ACTIVE**
Version: 1.0
Task ID: `LAUNCH-OPS-002`

## 1. Purpose and Boundaries

This runbook provides a safe, repeatable procedure for executing a database backup/restore drill for Polutek.pl.

- **Isolation Invariant:** This is a **non-production restore drill**. Production must never be overwritten.
- **Isolate Target:** The restore target must be a temporary, isolated database instance or branch.
- **Read-Only Verification:** The `scripts/verify-restored-database.ts` script is strictly read-only.
- **No Certification by Docs:** Completion of this documentation alone does not certify backup readiness; a real successful restore must be executed and verified.

## 2. Roles

- **Operator:** Executes the restoration and verification.
- **Reviewer:** Verifies the evidence and signs off on the drill report.

## 3. Preconditions

- [ ] Current `main` SHA recorded.
- [ ] Provider dashboard access available (or Mode B if unavailable).
- [ ] Verified backup/snapshot identifier selected.
- [ ] Temporary isolated restore target instance/database created.
- [ ] `RESTORE_DATABASE_URL` prepared (must differ from `DATABASE_URL`).
- [ ] `ALLOW_RESTORE_VERIFICATION=true` confirmed.

## 4. Backup Capability Evidence (Provider Neutral)

Record the following in the evidence report:
- Provider Name
- Backup Type (Automated Snapshot, Manual Dump, etc.)
- Schedule (e.g., Daily at 03:00 UTC)
- Retention Policy (e.g., 7 days, 30 days)
- PITR (Point-in-Time Recovery) availability
- Encryption status of backups at rest

## 5. Source Manifest Preparation

Before restoration, an operator may optionally prepare a redacted manifest of safe aggregates from the production database to use as a baseline for comparison.

1. Run the verifier against production in a controlled environment to get baseline counts (REDACT ALL PII).
2. Store counts in a local `manifest.json` following the safe template.

## 6. Temporary Restoration Procedure

1. **Select Backup:** Choose a known good backup/snapshot.
2. **Provision Target:** Create a new temporary database instance or branch.
3. **Dedicated Credential:** Create a temporary credential for the isolated instance.
4. **Environment Setup:** Set `RESTORE_DATABASE_URL` in a local shell. **NEVER** commit this URL.
5. **Safety Check:** Confirm that `RESTORE_DATABASE_URL` does NOT match the production `DATABASE_URL`.

## 7. Verification

Run the verifier script:

```bash
ALLOW_RESTORE_VERIFICATION=true \
RESTORE_DATABASE_URL="<secret temporary restore URL>" \
RESTORE_EXPECTED_MANIFEST_PATH="<optional local redacted manifest>" \
npx tsx scripts/verify-restored-database.ts
```

**WARNING:** Do not paste the URL into terminal screenshots, PR comments, or GitHub Actions logs.

Then run the standard smoke check against the temporary database:

```bash
DATABASE_URL="<temporary URL>" \
DATABASE_URL_UNPOOLED="<temporary URL>" \
npm run db:smoke
```

## 8. Cleanup

1. **Destroy Target:** Delete the temporary database instance/branch immediately after verification.
2. **Revoke Credentials:** Delete the temporary credentials.
3. **Purge Secrets:** Delete local `.env` or temporary files containing the restore URL.
4. **Verify Production:** Confirm that the production environment remains unchanged and unaffected.

## 9. Abort Conditions

Abort the drill immediately if:
- `RESTORE_DATABASE_URL` matches production.
- Any write operation is detected during verification.
- Restoration fails to provision an isolated target.
- Secrets appear in any output or logs.
- Hard relational corruption is detected in the restored snapshot.

## 10. Escalation

If an unexpected failure occurs during restoration or verification that suggests a production backup failure, escalate to the system owner immediately.
