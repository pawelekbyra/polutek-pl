# Incident Response Runbook

This runbook provides procedures for detecting, classifying, containing, and resolving production incidents on Polutek.pl.

## Severity Levels

| Level | Description | Acknowledge | Containment | Postmortem |
| --- | --- | --- | --- | --- |
| **SEV-0** | Security exposure (source/token leakage), critical data loss | 15 min | Immediate | Required |
| **SEV-1** | Widespread outage, payment/access truth corruption | 30 min | < 2 hours | Required |
| **SEV-2** | Major feature degraded (e.g., video not playing) with workaround | 2 hours | < 8 hours | Recommended |
| **SEV-3** | Isolated failure, non-critical degradation | 1 business day | N/A | Optional |

### Response Targets
- **Communication:** Internal channel updated every 30m for SEV-0/1.
- **Rollback:** Prefer rollback if latest deployment is suspected.
- **Evidence:** Preserve logs and redacted state before any destructive fix.

---

## Security Incident Rules (SEV-0)

**Applicable to:** Suspected source/token/private URL leakage.

1. **Do Not Paste Secrets:** Never paste raw sources, tokens, or private URLs into GitHub, chat, or logs.
2. **Redact Identifiers:** Capture only redacted identifiers (e.g., `asset_uid_...`) and timestamps.
3. **Revoke Credentials:** If exposure is confirmed, rotate `CLOUDFLARE_API_TOKEN` or relevant keys immediately.
4. **Disable Path:** Disable the affected playback path (e.g., set video to `DRAFT`) if safe.
5. **Verify Denial:** After containment, confirm denied playback (403/404) for unauthorized users.

---

## Payment & Access Rules

1. **Restore Truth:** Never "fix" access by manually setting `User.isPatron = true` or Clerk metadata.
2. **Correct Fact:** Recovery must involve creating or correcting the `Payment` record and `PatronGrant`.
3. **Audit Trail:** Every manual correction requires a documented reason and audit log entry.

---

## Playbooks

### A. Production deployment is down
- **Detection:** Uptime alert, 5xx errors in Vercel.
- **Checks:** Check Vercel Status, check if latest deploy was successful.
- **Containment:** Rollback to last known green deployment.
- **Forbidden:** Do not attempt hotfixes on a down production without verifying in preview.

### B. Latest deployment build failed
- **Detection:** Vercel/Git notification.
- **Checks:** Inspect build logs for type errors or missing dependencies.
- **Safe Action:** Re-run build if intermittent; revert latest commit if code-related.
- **Forbidden:** Do not bypass build guards.

### C. Stripe payment succeeded but no PatronGrant exists
- **Detection:** User report or reconciliation audit drift.
- **Checks:** Stripe Dashboard (payment success) vs App Audit Logs (grant creation).
- **Safe Action:** Re-send Stripe webhook from Stripe Dashboard.
- **Verification:** Confirm `PatronGrant` is created with the same `stripePaymentIntentId`.

### D. Duplicate Stripe events created inconsistent records
- **Detection:** Multiple `Payment` records for same Intent ID.
- **Checks:** Search `StripeEvent` table for duplicate `eventId`.
- **Safe Action:** Remove duplicate `Payment` record; keep the one linked to the `PatronGrant`.
- **Forbidden:** Do not delete the financial record of truth without audit.

### E. Refund/dispute did not update PatronGrant correctly
- **Detection:** Refunded user still has access.
- **Checks:** Stripe Dashboard for refund status vs `PatronGrant` status.
- **Safe Action:** Manually revoke/suspend `PatronGrant` with reason "Manual Refund Sync".
- **Forbidden:** Do not delete the grant; change status only.

### F. Patron has active grant but is denied access
- **Detection:** User report.
- **Checks:** Admin Access Diagnostics for the User ID. Check `checkVideoAccess` logs.
- **Safe Action:** Force-refresh Clerk metadata if used for cache; verify backend grant truth.

### G. User has access without active PatronGrant
- **Detection:** Audit logs show access for user with no active grant.
- **Checks:** Check for legacy `User.isPatron` status or Clerk metadata bypass.
- **Containment:** Manually set `User.isPatron = false` and clear Clerk metadata; ensure backend logic uses `PatronGrant`.

### H. Cloudflare asset is stuck processing
- **Detection:** Admin Media Tab shows `PROCESSING` for > 4 hours.
- **Checks:** Cloudflare Dashboard for asset status.
- **Safe Action:** Trigger manual status resync via Admin UI.

### I. Cloudflare asset is FAILED
- **Detection:** Admin Media Tab or Cloudflare Dashboard.
- **Checks:** Inspect Cloudflare error code (e.g., encoding fail).
- **Safe Action:** Delete asset record and re-upload.

### J. Cloudflare webhook is not arriving
- **Detection:** Asset stays `PENDING` despite being `READY` in Cloudflare.
- **Checks:** Cloudflare Dashboard Webhook logs for 5xx or timeouts.
- **Safe Action:** Manually update asset status in Admin UI. Verify webhook secret in Env.

### K. READY Cloudflare asset does not play
- **Detection:** User report / smoke test.
- **Checks:** Check if `signed: true` is set. Check playback token resolution logs.
- **Safe Action:** Disable signed playback temporarily if confirmed to be a token issue.

### L. Signed playback source/token resolution fails
- **Detection:** 403 in browser console from Cloudflare.
- **Checks:** Check `CLOUDFLARE_API_TOKEN` scope and `CLOUDFLARE_WEBHOOK_SECRET`.
- **Safe Action:** Verify token generation logic in `lib/modules/video`.

### M. Suspected source/token/private URL leakage
- **Classification:** SEV-0 until disproven.
- **Detection:** Secret in logs, public report.
- **Action:** Follow [Security Incident Rules](#security-incident-rules-sev-0).

### N. Database unavailable
- **Detection:** 500 errors, "PrismaClientInitializationError".
- **Checks:** DB Provider status page. Check `DATABASE_URL` connectivity.
- **Containment:** Static "Maintenance Mode" page on Vercel if possible.

### O. Clerk/authentication unavailable
- **Detection:** Users cannot sign in, "ClerkAPIError".
- **Checks:** Clerk Status page.
- **Containment:** Inform users on social/landing page.

### P. Comments authorization regression
- **Detection:** Guest can post comment.
- **Checks:** Check `CommentAccess` policy logic.
- **Safe Action:** Set all comments to `HELD_FOR_REVIEW` or disable comments globally via feature flag.

### Q. Resend/email outage
- **Detection:** Broadcast failures, Resend Dashboard errors.
- **Checks:** API Key validity, Domain DNS status.
- **Safe Action:** Pause all scheduled broadcasts.

### R. Unexpected Cloudflare cost spike
- **Detection:** Billing alert or Dashboard usage graph.
- **Checks:** Identify specific asset or IP causing high egress.
- **Safe Action:** Disable high-usage asset or rotate signing keys.

---

## Launch-Day Control Checklist

- [ ] **Named Operator:** ____________________
- [ ] **Go/No-Go Owner:** ____________________
- [ ] **Dashboard Tabs Open:** Vercel, Stripe, Cloudflare, Resend, Clerk, DB.
- [ ] **Test Accounts:** Guest, Signed-in Non-Patron, Patron, Admin.
- [ ] **Rollback Target:** Last stable commit hash identified.
- [ ] **Communication Channel:** #incident-production (Slack/Discord/Teams).
- [ ] **No Secrets Rule:** All participants briefed on redaction rules.
- [ ] **Observation Window:** T+0 to T+12 hours.
- [ ] **Support Route:** Designated support email/channel monitored.
