# LAUNCH-EMAIL-001 — Email consent, unsubscribe and suppression readiness report

Status: `READY_FOR_OWNER_REVIEW`  
Runtime implementation: `BLOCKED`  
Production evidence: `PRODUCTION_EVIDENCE_REQUIRED`  
Verdict for this docs-only PR: `MERGE`

## 1. Executive summary

This docs-only readiness pack audited the current email lifecycle from subscription consent through local preference, recipient selection, Resend contact state, broadcast delivery, unsubscribe, bounce/complaint handling, and optional re-subscription.

Confirmed launch-critical findings:

- Current unsubscribe links expose raw encoded email addresses in URLs.
- No public `app/**/unsubscribe/**` route was found.
- The existing `DELETE /api/subscriptions` path requires an authenticated user and removes only the app `Subscription` record for the signed-in user/main channel.
- Template email sending can attempt to create a Resend audience contact with `unsubscribed:false` after every template send when `RESEND_AUDIENCE_ID` is configured.
- Broadcast eligibility checks local `EmailPreference.marketingEmails`, but missing preference defaults to enabled.
- `EmailPreference.marketingEmails` defaults to `true`; `systemEmails` exists separately but was not found as an active send gate for system/template emails.
- Resend bounce and complaint webhooks update broadcast-recipient status, but no global bounce/complaint suppression was confirmed.
- Provider webhook payloads, inbound email content, broadcast recipient emails, logs, audit metadata, and provider IDs require owner/legal retention and redaction decisions.
- Welcome copy can claim newly registered users can comment/rate, which may conflict with patron/admin write rules for patron-only interactions.

This report does not approve legal policy, does not claim GDPR/ePrivacy/marketing-law compliance, does not certify secure production delivery, and does not claim public launch readiness.

## 2. Baseline main SHA

Baseline inspected SHA: `8123d90505eb68bcc1573b5ac16174dd6c13f8d4`.

Environment note: the local repository did not expose an `origin` remote or a local `main` branch during inspection, so this work started from the provided current workspace branch at the SHA above. No runtime files were modified.

## 3. Scope and limitations

### In scope

Read-only inspection of email lifecycle code and docs requested by the owner prompt:

- subscriptions route/use cases;
- subscribe UI surface;
- email templates/defaults;
- legacy email service;
- email module broadcast, policy, repository, provider bridge, and Resend webhook handling;
- schema models for `Subscription`, `EmailPreference`, `BroadcastEmail`, `BroadcastEmailRecipient`, `EmailEvent`, `InboundEmail`, `Payment`, `PatronGrant`, and related `User` fields;
- ensure/seed scripts for email templates;
- prior legal readiness report and questionnaire.

### Out of scope

- No runtime implementation.
- No webhook/security modification.
- No schema or migration modification.
- No build, lint, typecheck, tests, seed, migration, or provider calls.
- No legal conclusion or policy approval.
- No broad unrelated payment, playback, comments, or admin audit beyond locating email triggers and required product invariants.

## 4. Email type inventory

Classification vocabulary used: `VERIFIED_CURRENT_FACT`, `SAFE_CURRENT_BEHAVIOR`, `CONSENT_POLICY_REQUIRED`, `SUPPRESSION_GAP`, `UNSUBSCRIBE_GAP`, `PRIVACY_LOGGING_RISK`, `IMPLEMENTATION_UNKNOWN`, `OWNER_DECISION_REQUIRED`, `LEGAL_REVIEW_REQUIRED`, `BLOCKED`.

No row below is a legal classification of transactional vs marketing; all category decisions remain owner/legal-review decisions.

| Email type/template | Trigger | Transactional or marketing candidate | Recipient source | Local preference checked | Provider suppression checked | Unsubscribe link | Current risk | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Welcome (`welcome-email`) | Clerk `user.created` side effect calls `EmailService.sendWelcomeEmail`. | Mixed/needs owner+legal review. | Clerk user email synced into local user handling. | No `EmailPreference` or `systemEmails` gate found before send. | No provider suppression read found; template path may write contact with `unsubscribed:false`. | Template variables include `/unsubscribe?email=<encoded email>` if template uses it. | Copy says users can comment/rate; audience sync can re-subscribe provider contact. | `CONSENT_POLICY_REQUIRED`, `SUPPRESSION_GAP`, `PRIVACY_LOGGING_RISK`, `OWNER_DECISION_REQUIRED` |
| Account deletion (`account-deleted`) | User soft delete sends account-deleted email to prior email after anonymizing local user. | Candidate system/transactional; owner/legal review required. | Prior local user email captured before deletion. | No `EmailPreference` or `systemEmails` gate found before send. | No provider suppression read found; template path may write contact with `unsubscribed:false`. | Template variables include raw email unsubscribe link if template uses it. | Deletion confirmation can sync deleted address back into Resend audience. | `SUPPRESSION_GAP`, `PRIVACY_LOGGING_RISK`, `LEGAL_REVIEW_REQUIRED`, `BLOCKED` |
| Password/security (`password-changed`) | Clerk password update handling calls `EmailService.sendPasswordChangedEmail`. | Candidate system/security; owner/legal review required. | Local user email. | No `EmailPreference.systemEmails` gate found before send. | No provider suppression read found; template path may write contact with `unsubscribed:false`. | Template variables include raw email unsubscribe link if template uses it. | Security email shares audience contact sync with marketing-related flows. | `SUPPRESSION_GAP`, `OWNER_DECISION_REQUIRED`, `LEGAL_REVIEW_REQUIRED` |
| Payment thank-you (`thank-you-donation`) | Payment fulfillment sends donation thank-you. | Candidate payment/relationship email; owner/legal review required. | Payment/user email path. | No marketing preference gate found before send. | No provider suppression read found; template path may write contact with `unsubscribed:false`. | Template variables include raw email unsubscribe link if template uses it. | Support/payment email can be mixed with promotional copy and provider audience sync. | `CONSENT_POLICY_REQUIRED`, `SUPPRESSION_GAP`, `LEGAL_REVIEW_REQUIRED` |
| Patron granted (`become-patron`) | Payment fulfillment sends patron-granted email. | Candidate access/status email; owner/legal review required. | Payment/user email path. | No marketing preference gate found before send. | No provider suppression read found; template path may write contact with `unsubscribed:false`. | Template variables include raw email unsubscribe link if template uses it. | Patron access notification can be confused with marketing and provider subscription state. | `CONSENT_POLICY_REQUIRED`, `SUPPRESSION_GAP`, `OWNER_DECISION_REQUIRED` |
| Broadcast/newsletter | Admin broadcast send use case creates `BroadcastEmail` and recipients; legacy provider sends. | Candidate marketing/newsletter. | Audience may be all users, subscribers, patrons, non-patrons, manual, or test depending admin input. | Yes for non-test path, but missing preference defaults true in policy and legacy send. | No provider suppression read confirmed before send. | Broadcast variables include `/unsubscribe?email=<encoded recipient.email>`. | Missing preference eligible; raw email URL; no global bounce/complaint suppression confirmed. | `CONSENT_POLICY_REQUIRED`, `UNSUBSCRIBE_GAP`, `SUPPRESSION_GAP`, `BLOCKED` |
| Manual/admin email | Admin manual recipients or comma-separated emails. | Candidate marketing/manual communication; owner/legal review required. | Admin-entered email addresses. | Same policy check; missing preference defaults true. | No provider suppression read confirmed before send. | Broadcast variables include raw email unsubscribe link. | Manual recipient may lack explicit consent or local preference record. | `CONSENT_POLICY_REQUIRED`, `UNSUBSCRIBE_GAP`, `PRIVACY_LOGGING_RISK`, `LEGAL_REVIEW_REQUIRED` |
| Test email | Admin broadcast test path sends directly via provider. | Operational test email; owner policy required. | Admin-provided test recipient. | Test path bypasses non-test preference filtering. | No provider suppression read confirmed. | Uses supplied body; no guaranteed unsubscribe link. | Audit metadata stores test recipient email and subject. | `PRIVACY_LOGGING_RISK`, `OWNER_DECISION_REQUIRED` |
| Support/inbound replies | Resend `email.received` webhook creates `InboundEmail`. | Support/inbound; policy required. | Provider inbound data: from/to/subject/text/html. | Not applicable to receiving. | Not applicable to receiving; no retention policy confirmed. | Not applicable. | Full inbound content and sender/recipient addresses stored. | `PRIVACY_LOGGING_RISK`, `OWNER_DECISION_REQUIRED`, `LEGAL_REVIEW_REQUIRED` |
| Moderation/incident notices | No dedicated current template confirmed in inspected email defaults or service wrappers. | `IMPLEMENTATION_UNKNOWN`. | Unknown. | Unknown. | Unknown. | Unknown. | Future notices need category and preference/system-email policy before launch. | `IMPLEMENTATION_UNKNOWN`, `OWNER_DECISION_REQUIRED` |

## 5. Current consent truth

Current implementation has multiple partially overlapping email concepts:

- `Subscription`: authenticated channel-follow/email-notification record between `User` and main `Creator`.
- `EmailPreference`: email-address-level preference with `marketingEmails`, `systemEmails`, `unsubscribedAt`, and optional `resendContactId`.
- `BroadcastEmailRecipient`: per-broadcast recipient/delivery record containing full recipient email, status, Resend ID, error, and timestamps.
- Resend contact state: provider audience contact created by template sends when `RESEND_AUDIENCE_ID` exists; current code writes `unsubscribed:false` and does not first check provider suppression.
- Resend events: webhook creates `EmailEvent`, updates broadcast recipient status for delivery/bounce/complaint/open/click, and handles provider unsubscribe by local `EmailPreference.marketingEmails=false`.
- Clerk user/account: source for user creation, welcome, deletion, and password-change emails.
- `PatronGrant`: access/right/status model separate from email consent.

Confirmed invariants:

- `Subscription` never grants patron access in inspected subscription use cases.
- `PatronGrant` never automatically means newsletter consent by product invariant; current broadcast audience code can select patrons, so owner/legal policy must decide if and when a patron audience may receive marketing.
- Payment never automatically means newsletter consent in inspected payment email path; payment fulfillment sends payment/patron emails but no subscription creation was found there.
- Clerk registration alone must not be treated as confirmed marketing consent unless owner/legal policy explicitly says so; current fallback behavior is unsafe because missing `EmailPreference` means broadcast-eligible.
- Transactional/system delivery permission and marketing consent are distinct concepts; `systemEmails` exists but is not active in the inspected template send path.

Current source of truth for marketing eligibility:

- For admin non-test broadcast selection, `EmailPolicy.canReceiveBroadcastEmail` checks `EmailPreference.marketingEmails` by email and returns `true` when the record is missing.
- Legacy broadcast sending repeats the same effective fallback by loading preferences for pending recipients and using `prefMap.get(email) ?? true`.
- Recipient selection can come from `Subscription`, user patron flags, all/non-patron users, manual admin input, or test input before filtering.

Precedence classification if records disagree: `unsafe` and `owner decision required`.

Why:

- Local preference is checked for broadcast send eligibility, but missing local preference means enabled.
- Provider contact unsubscribe/suppression is not read before sending.
- Template sends can write provider contact as `unsubscribed:false`, potentially reversing provider state.
- Bounce/complaint statuses are per-broadcast-recipient and were not found to create a global suppression gate.

## 6. Subscription/preference/provider relationship

| Record/source | Current role | Relationship to others | Risk/precedence |
| --- | --- | --- | --- |
| `Subscription` | Authenticated app channel email-notification/follow record. | Created/deleted by signed-in `/api/subscriptions`; not linked to `EmailPreference` in inspected use cases. | Does not prove legal marketing consent beyond owner-approved UI/copy. Missing preference fallback can still make non-subscribers eligible in some audiences. |
| `EmailPreference` | Email-address preference record. | Broadcast policy checks `marketingEmails`; Resend unsubscribe webhook upserts it false. | Defaults to `marketingEmails=true`; missing record means eligible. `systemEmails` not found as active send gate. |
| `BroadcastEmailRecipient` | Per broadcast recipient and delivery status. | Created from selected audience; stores email, status, Resend ID, error/timestamps. | Bounce/complaint statuses remain per-recipient/per-broadcast unless future suppression uses them. |
| Resend contact | Provider audience contact. | Template sends create contacts with `unsubscribed:false` when configured. | Provider suppression can be overwritten; no current authoritative reconciliation. |
| Resend delivery/bounce/complaint/unsubscribe events | Provider event stream. | Stored as `EmailEvent`; delivery updates recipient status; unsubscribe upserts local preference false. | Bounce/complaint do not update local preference or global suppression in inspected code. Payload retention unknown. |
| Clerk user/account | Auth/source for user lifecycle. | User creation/deletion/password update trigger emails. | Signup/welcome must not become implicit marketing consent without owner/legal policy. |
| `PatronGrant` | Patron access truth. | Separate from email models. | Broadcast audience can target patrons using user patron flag; must not imply consent. |

## 7. Unsubscribe URL risk

Confirmed current shape:

```txt
/unsubscribe?email=<encoded email>
```

Risk areas without legal conclusion:

- Browser history can store the address-bearing URL.
- Server/application/proxy logs can capture the full query string.
- Analytics tools can capture URLs unless explicitly configured not to.
- Referrer headers can expose the URL when navigating away from the unsubscribe page.
- Screenshots, support tickets, screen sharing, and shared devices can reveal the email address.
- Copied/forwarded links and URL scanners can expose the address.
- Email clients, security gateways, and link-preview scanners may request or inspect the URL.

Future implementation should use one of the following repository-compatible patterns after design approval:

- opaque random token stored server-side with expiration/replay policy;
- signed short payload that does not reveal raw email and has expiration/replay controls;
- another established safe method that avoids raw email in URL and avoids existence enumeration.

Final token design belongs to `LAUNCH-EMAIL-002` after owner/legal/security decisions.

## 8. Auth-required unsubscribe gap

Current failure mode:

- Email links point to `/unsubscribe?email=...`, but no public app unsubscribe route was found.
- The existing API unsubscribe route is `DELETE /api/subscriptions`, and it calls `requireUserAndGetContext` before `UnsubscribeUseCase`.
- `UnsubscribeUseCase` requires the signed-in actor user ID and deletes `Subscription` for that user/main channel.

Recipient scenarios likely to fail or be incomplete today:

- Logged-out recipient: cannot call current API without login.
- Recipient with deleted/no account: no signed-in user context exists; deletion confirmation may still be sent to prior email.
- Recipient using a different Clerk email: unsubscribe action applies to signed-in user, not necessarily the email in the message URL.
- Manual/admin broadcast recipient: may not have an app account or local `Subscription` record.
- Recipient wanting one-click removal: no public logged-out idempotent unsubscribe route found.

Classification: `UNSUBSCRIBE_GAP`, `BLOCKED`.

## 9. Provider re-subscription risk

Confirmed code behavior:

- After every `sendTemplateEmail` send, if `RESEND_AUDIENCE_ID` is configured, the service calls Resend contact creation with `unsubscribed:false`.
- This template path is shared by welcome, account deletion, password/security, donation thank-you, and patron-granted emails.

Potential re-subscription scenarios:

| Scenario | Can current template path attempt provider contact write with `unsubscribed:false`? | Notes |
| --- | --- | --- |
| Local marketing opt-out | Yes, no local preference gate found before template audience sync. | Confirmed launch-critical risk. |
| Provider unsubscribe | Yes, later template send can attempt contact creation with `unsubscribed:false`. | Confirmed launch-critical risk if provider accepts update/create semantics. |
| Complaint | Yes, no complaint suppression gate found before template audience sync. | Confirmed gap; provider behavior still implementation/provider dependent. |
| Bounce | Yes, no bounce suppression gate found before template audience sync. | Confirmed gap; provider behavior still implementation/provider dependent. |
| Account deletion | Yes, account-deleted email uses same template send path to prior email. | Confirmed launch-critical risk. |

Classification: `SUPPRESSION_GAP`, `BLOCKED`, launch-critical.

## 10. Default marketing preference risk

Confirmed current behavior:

- Schema default: `EmailPreference.marketingEmails Boolean @default(true)`.
- Schema has `EmailPreference.systemEmails Boolean @default(true)` separately.
- `EmailPolicy.canReceiveBroadcastEmail` returns `preference?.marketingEmails ?? true`.
- Legacy broadcast sending loads all preferences into a map and uses `prefMap.get(recipient.email) ?? true`.
- Subscribe use case creates `Subscription`; no linked `EmailPreference` creation was found in inspected subscription use cases.
- Manual/admin recipient selection can include emails with no `EmailPreference` and still pass the missing-preference fallback.

Meaning of missing preference today: `enabled` for broadcast policy and legacy broadcast send. This is not a desired policy statement; it is current implementation behavior requiring owner/legal decision.

Classification: `CONSENT_POLICY_REQUIRED`, `OWNER_DECISION_REQUIRED`, `LEGAL_REVIEW_REQUIRED`, `BLOCKED`.

## 11. Transactional/marketing separation

Current separation is incomplete:

- The same `sendTemplateEmail` function handles welcome, account deletion, password/security, payment thank-you, and patron-granted emails.
- The same function injects `unsubscribeLink` and `preferencesLink` variables for all templates.
- The same function performs Resend audience contact sync for all templates when `RESEND_AUDIENCE_ID` exists.
- No `systemEmails` gate was found in the send path.
- Broadcast/newsletter uses separate broadcast records and local marketing preference checks.

Policy implications needing owner/legal decision:

- Marketing unsubscribe should normally affect marketing/newsletter broadcasts, but whether it affects welcome, payment, patron, account-deletion, password/security, support, or incident messages must be explicitly approved.
- System/security emails should not re-subscribe a user to marketing or change provider marketing contact state.
- Payment/patron emails must not imply newsletter consent.
- PatronGrant must remain unrelated to newsletter consent.

Classification: `OWNER_DECISION_REQUIRED`, `LEGAL_REVIEW_REQUIRED`, `SUPPRESSION_GAP`.

## 12. Bounce/complaint handling

Confirmed Resend webhook behavior:

- `email.bounced` updates matching `BroadcastEmailRecipient` status to `BOUNCED` and increments broadcast error count when applicable.
- `email.complained` updates matching `BroadcastEmailRecipient` status to `COMPLAINED` and increments broadcast error count when applicable.
- `email.unsubscribed` upserts `EmailPreference` with `marketingEmails:false` and `unsubscribedAt`.
- `EmailEvent` is created with provider payload for events before handling supported event types.
- Idempotency is best-effort by existing `EmailEvent` with same `resendEmailId` and event type.

Not confirmed/current gaps:

- Bounce does not update `EmailPreference`.
- Complaint does not update `EmailPreference`.
- Bounce/complaint do not update Resend contact.
- Bounce/complaint do not create a global suppression record.
- Bounce/complaint do not prevent future broadcasts except for the specific recipient row/status in a single broadcast.
- Bounce/complaint do not prevent future template/system emails.
- Duplicate detection does not use a durable unique constraint for provider event IDs in the inspected schema.

Classification: `SUPPRESSION_GAP`, `BLOCKED`.

## 13. Logging and retention risks

Inventory and classification:

| Data/log surface | Current fact | Classification |
| --- | --- | --- |
| Template send failure logs | Logs slug and full `to` email; error object may include provider details. | `PRIVACY_LOGGING_RISK`, redaction required decision |
| Template audience sync logs | Logs full email and audience ID on success/failure. | `PRIVACY_LOGGING_RISK`, redaction required decision |
| Template send success logs | Logs full email and Resend message ID. | `PRIVACY_LOGGING_RISK`, redaction required decision |
| Broadcast send failure logs | Logs full recipient email and error object. | `PRIVACY_LOGGING_RISK`, redaction required decision |
| Test email audit metadata | Stores test recipient email and subject. | operationally useful, retention/redaction unknown |
| Broadcast audit metadata | Stores audience, recipient count, and subject. | operationally useful, retention unknown |
| `BroadcastEmailRecipient` | Stores full email, Resend ID, error, delivery/bounce/complaint timestamps. | operationally necessary but retention unknown |
| `EmailEvent` | Stores recipient email and full provider payload JSON. | potentially excessive, retention unknown, legal review required |
| `InboundEmail` | Stores from/to email, subject, text, HTML, Resend ID. | potentially sensitive support content; retention unknown |
| Webhook logs | Logs Resend email ID and event ID; error paths log objects. | provider identifier exposure; redaction required decision |
| Clerk side-effect errors | Uses `console.error` with error object for email failures. | retention/redaction unknown |

## 14. Stale email copy findings

Welcome copy issue:

- Default welcome template says registered users have access to basic platform features such as commenting and rating materials.
- Fallback welcome copy says users can now comment and rate videos.
- Current product invariants state comments under patron-only video are visible to all, but writing/reacting/commenting under patron-only videos requires patron or admin.

Risk:

- Welcome email may over-promise write permissions for patron-only content.
- Copy should be owner-reviewed before public launch; no runtime copy change was made in this docs-only ticket.

Classification: `OWNER_DECISION_REQUIRED`, `CONSENT_POLICY_REQUIRED` for mixed onboarding/marketing tone.

## 15. Owner decisions required

Owner must decide:

- explicit opt-in vs any automatic newsletter subscription behavior;
- whether signup may create marketing consent;
- whether support/payment may create marketing consent;
- whether PatronGrant may ever imply marketing consent, despite product invariant that Patron != newsletter subscriber;
- double opt-in requirement;
- launch jurisdictions;
- legal review requirement;
- per-template/system/marketing/mixed/disabled classification;
- logged-out and one-click unsubscribe requirements;
- unsubscribe scope: marketing only vs system/security effects;
- re-subscribe rules and explicit confirmation requirements;
- local-vs-provider source of truth precedence;
- bounce and complaint suppression rules;
- account deletion email/provider contact behavior;
- retention/redaction policy for events, payloads, logs, inbound content, recipient records, and evidence;
- whether schema changes are authorized for tokens/suppression/audit evidence.

See `docs/operations/email-consent-owner-questionnaire.md`.

## 16. Legal review questions

Legal review should answer or approve owner answers for:

- Is current/future newsletter consent model acceptable for launch jurisdictions?
- Are signup welcome emails, payment thank-you emails, patron-granted emails, account deletion, and password/security emails legally transactional, marketing, mixed, or disabled for launch?
- What unsubscribe requirements apply to marketing emails, mixed emails, and provider-hosted unsubscribe events?
- Is one-click/logged-out unsubscribe required?
- What must happen to marketing consent after bounce, complaint, provider unsubscribe, account deletion, and re-subscription?
- What evidence must be retained to prove unsubscribe/consent without storing excessive personal data?
- What retention periods apply to provider payloads, inbound email content, delivery events, broadcast recipient records, audit metadata, and logs?
- What copy is approved for Polish/English unsubscribe, already-unsubscribed, invalid/expired token, preference settings, and support fallback states?

## 17. Future secure implementation contract

`LAUNCH-EMAIL-002` must consider:

- public logged-out unsubscribe;
- no raw email in URL;
- token expiration policy;
- opaque random token, signed short payload, or another repository-compatible method chosen by design review;
- idempotent unsubscribe;
- no existence enumeration;
- generic success response;
- local preference update;
- provider contact update;
- broadcast suppression;
- complaint/bounce suppression;
- explicit re-subscribe behavior;
- transactional/marketing separation;
- audit evidence without excessive PII;
- no relationship to `PatronGrant` access;
- rate limiting;
- replay safety;
- focused tests;
- schema change decision as single-writer owner-approved work if current models cannot support a safe implementation.

Do not execute `LAUNCH-EMAIL-002` until unblocked.

## 18. Verification checklist

Future preview/production checks are defined in `docs/operations/email-unsubscribe-suppression-verification-checklist.md` and include:

1. subscribe with explicit approved flow;
2. verify local status;
3. verify Resend contact status;
4. receive marketing test email;
5. use logged-out unsubscribe link;
6. confirm URL contains no raw email;
7. confirm generic response;
8. repeat link idempotently;
9. confirm local suppression;
10. confirm provider suppression;
11. attempt another broadcast;
12. confirm recipient is skipped;
13. verify system email behavior according to owner decision;
14. test complaint event;
15. test hard bounce;
16. verify no accidental re-subscribe after transactional email;
17. verify logs are redacted;
18. verify account deletion behavior;
19. verify re-subscription when explicitly allowed;
20. capture redacted evidence.

No real customer addresses or secrets may appear in evidence.

## 19. Blocked implementation ticket

Created: `docs/tickets/blocked/LAUNCH-EMAIL-002-implement-secure-unsubscribe-and-suppression.md`.

Status: `BLOCKED`.

Blocked on:

- completed owner questionnaire;
- legal review decision;
- approved marketing-vs-transactional classification;
- approved unsubscribe semantics;
- approved bounce/complaint policy;
- decision whether schema change is allowed;
- security webhook changes merged/reconciled first.

## 20. Files changed

- `docs/tickets/ready/LAUNCH-EMAIL-001-email-consent-unsubscribe-suppression-readiness.md`
- `docs/operations/email-consent-owner-questionnaire.md`
- `docs/operations/email-unsubscribe-suppression-verification-checklist.md`
- `docs/reports/reconciliation/LAUNCH-EMAIL-001-EMAIL-CONSENT-UNSUBSCRIBE-SUPPRESSION-READINESS.md`
- `docs/tickets/blocked/LAUNCH-EMAIL-002-implement-secure-unsubscribe-and-suppression.md`

## 21. What did not change

- No runtime code.
- No webhook code.
- No security tests.
- No shared operational security/legal files.
- No schema or migrations.
- No package files.
- No README, roadmap, strategy, specs, or architecture docs.
- No email templates, seed scripts, or ensure scripts.
- No legal policy approval.
- No production evidence.

## 22. Collision note with security work

A separate agent may be working on `LAUNCH-SECURITY-001-security-boundary-audit-and-regression-pack`. This ticket intentionally did not modify runtime, webhook, security-test, or shared operational files.

`LAUNCH-EMAIL-002` must:

- wait for security webhook changes to merge and be reconciled;
- start from then-current `main`;
- avoid copying stale branch code;
- explicitly resolve ownership before touching webhook/security-adjacent paths.

## 23. Remaining blockers

- Owner questionnaire unanswered.
- Legal review decision absent.
- Marketing-vs-transactional classification absent.
- Unsubscribe semantics not approved.
- Bounce/complaint suppression policy not approved.
- Retention/redaction policy not approved.
- Secure token/suppression storage design not approved.
- Production evidence not collected.
- Security webhook work may still be in flight.

## 24. Exactly one next action

Owner completes `docs/operations/email-consent-owner-questionnaire.md` and marks which answers require professional legal review before `LAUNCH-EMAIL-002` is unblocked.

## 25. Verdict

Docs-only readiness PR verdict: `MERGE`.

Final status:

- readiness pack: `READY_FOR_OWNER_REVIEW`;
- runtime implementation: `BLOCKED`;
- production evidence: `PRODUCTION_EVIDENCE_REQUIRED`.

No legal compliance, secure production delivery, or public launch readiness is claimed.
