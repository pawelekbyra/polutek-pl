# Email unsubscribe and suppression verification checklist

Status: `PRODUCTION_EVIDENCE_REQUIRED`  
Related readiness ticket: `LAUNCH-EMAIL-001 — Email consent, unsubscribe and suppression readiness`  
Related blocked implementation ticket: `LAUNCH-EMAIL-002 — Implement secure unsubscribe and suppression`

## Evidence rules

- Do not use real customer email addresses in evidence.
- Do not include secrets, API keys, webhook secrets, raw provider signatures, or full provider payloads in evidence.
- Redact personal data in screenshots, logs, provider dashboards, exported records, and terminal output.
- Capture the environment, timestamp, test address alias, build/deploy identifier, and reviewer initials for every check.
- This checklist cannot certify legal compliance, secure production delivery, or public launch readiness by itself.

## Future preview/production checks

| # | Check | Expected evidence | Result | Evidence link/location | Notes |
| ---: | --- | --- | --- | --- | --- |
| 1 | Subscribe with explicit approved flow. | Screenshot/API evidence showing owner-approved consent copy and user action. | `TBD` | `TBD` | Use non-customer test alias only. |
| 2 | Verify local status. | Redacted database/admin evidence showing local consent/preference/subscription state according to approved policy. | `TBD` | `TBD` | Must distinguish `Subscription` and `EmailPreference`. |
| 3 | Verify Resend contact status. | Redacted Resend dashboard/API evidence showing expected contact state. | `TBD` | `TBD` | Do not expose audience ID in public artifacts. |
| 4 | Receive marketing test email. | Redacted inbox screenshot showing marketing test email and approved unsubscribe/preference links. | `TBD` | `TBD` | Confirm template category is approved for testing. |
| 5 | Use logged-out unsubscribe link. | Browser evidence from a signed-out session. | `TBD` | `TBD` | Must not require Clerk login. |
| 6 | Confirm URL contains no raw email. | Screenshot/text evidence showing opaque token or approved safe method only. | `TBD` | `TBD` | Check address bar, copied link, and email source. |
| 7 | Confirm generic response. | Screenshot showing no account/email existence disclosure. | `TBD` | `TBD` | Response should be same for valid, repeated, and unknown-safe requests where appropriate. |
| 8 | Repeat link idempotently. | Evidence that repeated unsubscribe does not error and does not re-enable anything. | `TBD` | `TBD` | Replay behavior must match approved token policy. |
| 9 | Confirm local suppression. | Redacted database/admin evidence showing `marketingEmails=false` or approved suppression state. | `TBD` | `TBD` | Include timestamp, not raw personal data. |
| 10 | Confirm provider suppression. | Redacted Resend contact evidence showing unsubscribed/suppressed state. | `TBD` | `TBD` | Local-vs-provider precedence must match owner decision. |
| 11 | Attempt another broadcast. | Dry-run or approved test broadcast evidence after unsubscribe. | `TBD` | `TBD` | Use a safe test broadcast only. |
| 12 | Confirm recipient is skipped. | Broadcast recipient record/status evidence showing skipped/suppressed behavior. | `TBD` | `TBD` | No send attempt should occur for marketing if suppressed. |
| 13 | Verify system email behavior according to owner decision. | Evidence for an approved system/security email after marketing unsubscribe. | `TBD` | `TBD` | Must match owner/legal classification. |
| 14 | Test complaint event. | Redacted webhook/provider simulation evidence and local suppression result. | `TBD` | `TBD` | Do not expose full payload or secret headers. |
| 15 | Test hard bounce. | Redacted webhook/provider simulation evidence and local suppression result. | `TBD` | `TBD` | Confirm future sends are blocked according to policy. |
| 16 | Verify no accidental re-subscribe after transactional email. | Evidence that sending an approved system email does not set provider contact to subscribed or local marketing enabled. | `TBD` | `TBD` | Launch-critical regression check. |
| 17 | Verify logs are redacted. | Redacted log excerpts showing masked emails/provider IDs and no full payloads. | `TBD` | `TBD` | Include failure-path logs if safely testable. |
| 18 | Verify account deletion behavior. | Redacted evidence showing account deletion does not re-enable marketing/provider contact. | `TBD` | `TBD` | Include final email behavior only after owner approval. |
| 19 | Verify re-subscription when explicitly allowed. | Evidence of approved re-subscribe confirmation and local/provider state transition. | `TBD` | `TBD` | Skip if owner disables re-subscription for launch. |
| 20 | Capture redacted evidence. | Evidence bundle index with filenames, redaction notes, environment, and reviewer. | `TBD` | `TBD` | No real customer addresses or secrets. |

## Completion criteria

This checklist is complete only when:

- owner questionnaire is completed;
- legal review decision is recorded;
- implementation has merged from then-current `main`;
- security webhook changes, if any, have been reconciled;
- all checks above have pass/fail results with redacted evidence;
- any failed launch-critical check has a blocked follow-up and no public-launch readiness claim is made.
