# Security launch verification checklist

Status: OPERATOR_CHECKLIST — requires preview or production-like evidence before any launch certification.

Do not paste real secrets, raw webhook bodies, signed playback URLs, customer payment details, cookies or authorization headers into reports. Record pass/fail status, timestamp, environment name and redacted request IDs only.

## Preconditions

- Use a preview or production-like environment with non-production test accounts and provider test-mode fixtures.
- Confirm operator has an admin test account and a non-admin test account.
- Confirm logs can be filtered by redacted request ID.
- Confirm rollback owner and escalation channel are known before testing.

## Manual checks

| Check | Steps | Expected evidence | Status |
| --- | --- | --- | --- |
| Guest admin denial | In a private/incognito browser, request an admin API mutation with no session. | 401/403 response with no resource data, no stack trace and a redacted request ID only. | PRODUCTION_EVIDENCE_REQUIRED |
| Non-admin admin denial | Sign in as a non-admin test user and attempt the same admin mutation. | 403 response before any database/provider side effect; logs omit customer/payment details. | PRODUCTION_EVIDENCE_REQUIRED |
| Admin mutation pre-authorization | As admin, perform one harmless or reversible admin action with a reason where required. | Audit entry exists; action occurs only after server-side admin authorization. | PRODUCTION_EVIDENCE_REQUIRED |
| Invalid Stripe webhook rejection | Send only a provider test-mode invalid-signature fixture to the preview webhook endpoint. | Non-2xx/handled rejection; zero payment/grant mutation; logs do not include raw payload, secret or full headers. | PRODUCTION_EVIDENCE_REQUIRED |
| Duplicate Stripe webhook idempotency | Replay the same verified test-mode event ID. | Existing event ledger prevents duplicate fulfillment or duplicate grant mutation. | PRODUCTION_EVIDENCE_REQUIRED |
| Invalid Clerk webhook rejection | Send only a provider test-mode invalid Svix signature fixture. | Rejected before user sync; logs are redacted. | PRODUCTION_EVIDENCE_REQUIRED |
| Invalid Cloudflare webhook rejection | Send only a test fixture with missing/wrong redacted webhook signature. | Rejected before asset mutation. Do not include real Cloudflare secrets or payload URLs in evidence. | PRODUCTION_EVIDENCE_REQUIRED |
| Denied media network inspection | As guest/non-patron, open a patron-only video and inspect network calls. | Locked/denied plan; no stream request, no signed token, no provider asset ID, no playback session/view event. | PRODUCTION_EVIDENCE_REQUIRED |
| Patron playback network inspection | As a patron test user, open a ready patron video. | Signed playback source is requested only after allowed backend plan; signed source is not printed in UI/log evidence. | PRODUCTION_EVIDENCE_REQUIRED |
| No token/provider ID in UI/logs | Search rendered UI and redacted logs around denied/non-ready playback. | No signed URL, token, provider asset ID, raw private path or stack trace. | PRODUCTION_EVIDENCE_REQUIRED |
| Comment public read | As guest, read published video comments. | Public comments render without a write session. | PRODUCTION_EVIDENCE_REQUIRED |
| Comment mutation authorization | As guest/non-patron, attempt write/reaction/report under a patron-only video. | Mutation denied; no comment/report/reaction row created. | PRODUCTION_EVIDENCE_REQUIRED |
| Owner/admin comment mutation | As owner of a comment and as admin, perform allowed edit/delete/moderation using test data. | Ownership/admin rules are enforced and moderation actions are audited. | PRODUCTION_EVIDENCE_REQUIRED |
| Rate-limit response | Trigger a low-risk test rate-limit path using test data only. | 429 response with generic wording and no internal rate-limit state. | PRODUCTION_EVIDENCE_REQUIRED |
| Health/diagnostic exposure | Request public health and admin diagnostics as guest/non-admin/admin. | Public health exposes only intended non-sensitive status; admin diagnostics require admin. | PRODUCTION_EVIDENCE_REQUIRED |
| Error-response redaction | Exercise representative invalid payloads for checkout, comments, playback and webhooks. | Responses omit stack traces, connection URLs, provider tokens, raw customer/payment data and signed playback values. | PRODUCTION_EVIDENCE_REQUIRED |
| Log redaction | Review logs by redacted request IDs from the above checks. | Logs omit secrets, full cookies/authorization headers, raw webhook customer data and signed playback URLs. | PRODUCTION_EVIDENCE_REQUIRED |
| Security headers | Inspect preview responses for CSP and baseline security headers. | Headers match configured policy; gaps are recorded without changing build-owned files in this ticket. | PRODUCTION_EVIDENCE_REQUIRED |
| Rollback/escalation | Dry-run the documented rollback decision path without changing production state. | Owner/escalation path and rollback trigger are documented in the launch runbook. | PRODUCTION_EVIDENCE_REQUIRED |

## Evidence format

For each check, record:

```txt
Check:
Environment:
Timestamp UTC:
Actor type:
Redacted request ID:
Observed status:
Side-effect verification:
Log redaction review:
Result: PASS / FAIL / BLOCKED
Notes:
```

## Stop conditions

Stop and escalate if any check exposes:

- a real secret, cookie, signed playback URL or provider token;
- a patron-only playable source for a denied actor;
- admin mutation by an unauthenticated or non-admin actor;
- payment/cache/newsletter/Clerk metadata signal unlocking patron access without an active PatronGrant;
- webhook mutation before authenticity verification;
- customer payment data or stack traces in public responses.
