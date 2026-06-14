# Blocked Tickets

Status: ACTIVE
Launch status: NO_GO

This index contains tickets that are confirmed gaps but are currently blocked by dependencies or owner decisions.

## Email Webhook Repair Program (Area V)

| ID | Title | Status | Depends on | Launch Impact |
| --- | --- | --- | --- | --- |
| EMAIL-WEBHOOK-LOCK-OWNERSHIP-001 | Add lease ownership and fencing | `BLOCKED` | POSTMERGE-VERIFY | **BLOCKER** |
| EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001 | Enforce event type integrity | `BLOCKED` | LOCK-OWNERSHIP | **HIGH** |
| EMAIL-WEBHOOK-ROUTE-SECURITY-001 | Harden Resend webhook auth | `BLOCKED` | POSTMERGE-VERIFY | **BLOCKER** |
| EMAIL-WEBHOOK-ERROR-SAFETY-001 | Prevent error/secret disclosure | `BLOCKED` | POSTMERGE-VERIFY | **HIGH** |
| EMAIL-WEBHOOK-COUNTER-SEMANTICS-001 | Define broadcast counter semantics | `BLOCKED` | POSTMERGE-VERIFY | **MEDIUM** |
| EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001 | Add event payload validation | `BLOCKED` | POSTMERGE-VERIFY | **HIGH** |
| EMAIL-WEBHOOK-MIGRATION-VERIFY-001 | Verify migration upgrade path | `BLOCKED` | POSTMERGE-VERIFY | **HIGH** |
| EMAIL-WEBHOOK-PRIVACY-RETENTION-001 | Minimize ledger data/retention | `BLOCKED` | POSTMERGE-VERIFY | **MEDIUM** |
| ARCH-CI-001 | Mandatory architecture/integration CI | `BLOCKED` | POSTMERGE-VERIFY | **HIGH** |
| EMAIL-WEBHOOK-FINAL-CERT-001 | Final Resend webhook certification | `BLOCKED` | ALL REPAIRS | **BLOCKER** |

## Other Blocked Tickets

| ID | Title | Status | Depends on | Launch Impact |
| --- | --- | --- | --- | --- |
| LAUNCH-EMAIL-002 | Implement secure unsubscribe | `BLOCKED` | EMAIL-CONSENT-BOUNDARY | **BLOCKER** |
| LAUNCH-LEGAL-002 | Publish owner-approved legal copy | `BLOCKED` | LEGAL-REVIEW | **BLOCKER** |
| LAUNCH-BLOCKED-001 | Owner legal/privacy copy | `BLOCKED` | OWNER_DECISION | **BLOCKER** |
| LAUNCH-BLOCKED-002 | Owner Cloudflare cost/retention | `BLOCKED` | OWNER_DECISION | **BLOCKER** |

## Promotion Rule
Tylko Integrator po wyniku `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001` może przenieść dokładnie jeden repair ticket do ready queue.
