# Email consent owner questionnaire

Status: `OWNER_REVIEW_REQUIRED`  
Related readiness ticket: `LAUNCH-EMAIL-001 — Email consent, unsubscribe and suppression readiness`  
Related blocked implementation ticket: `LAUNCH-EMAIL-002 — Implement secure unsubscribe and suppression`

## Instructions

Answer each question directly in the `Owner answer` field. Do not treat this questionnaire as legal advice. Use the `Legal review` field to mark whether professional review is required before implementation or launch.

Allowed answer examples:

- `YES`
- `NO`
- `DISABLED_FOR_LAUNCH`
- `OWNER_DECISION_PENDING`
- `LEGAL_REVIEW_REQUIRED`
- a short policy sentence

## 1. Consent model

| Question | Current implementation fact | Risk | Owner answer | Legal review |
| --- | --- | --- | --- | --- |
| Is newsletter/broadcast consent explicit opt-in? | The authenticated subscribe button creates a `Subscription`, but `EmailPreference.marketingEmails` defaults to `true`, and missing preference currently permits broadcasts. | Marketing email may be sent without a durable explicit preference record if recipient selection includes users without a preference. | `TBD` | `TBD` |
| May account signup automatically subscribe a user to marketing/newsletter email? | Clerk user creation sends a welcome email; no code path was found that creates `Subscription` or an explicit marketing preference from signup alone, but missing preference defaults to eligible for broadcasts. | Signup could be treated as implicit marketing eligibility by fallback behavior unless forbidden by policy and code. | `TBD` | `TBD` |
| May qualifying support/payment automatically subscribe a user to marketing/newsletter email? | Payment fulfillment sends donation/patron emails but no `Subscription` creation was found in the inspected payment email path. | Payment support could be confused with newsletter consent unless policy forbids automatic marketing subscription. | `TBD` | `TBD` |
| May `PatronGrant` automatically subscribe a user to marketing/newsletter email? | Product invariant says Patron != newsletter subscriber; current inspected email audience selection can target patrons as a broadcast audience, and missing preferences default eligible. | Patron status could become a marketing audience without explicit consent if owner/legal policy is not codified. | `TBD` | `TBD` |
| Is double opt-in required before marketing/newsletter delivery? | No double opt-in state or verification flow was found in the inspected models. | If required for launch scope, current implementation cannot prove confirmed consent. | `TBD` | `TBD` |
| Which countries/jurisdictions are in launch scope? | The app has Polish/English copy and no jurisdiction-specific consent policy in this readiness pack. | Consent, unsubscribe, retention, and transactional/marketing classification may depend on launch jurisdictions. | `TBD` | `TBD` |
| Is professional legal review required before public launch email sending? | Prior legal readiness work left newsletter/unsubscribe/preference route decisions open. | Owner-only decisions may be insufficient for public marketing or lifecycle email launch. | `TBD` | `TBD` |

## 2. Email categories

Owner must classify every current template or email surface as one of:

- `SYSTEM_TRANSACTIONAL`
- `MARKETING`
- `MIXED_NEEDS_REVIEW`
- `DISABLED_FOR_LAUNCH`

Do not use these categories as legal conclusions until legal review is completed.

| Email type/template | Current implementation fact | Risk | Owner answer | Legal review |
| --- | --- | --- | --- | --- |
| Welcome email (`welcome-email`) | Sent on Clerk `user.created`; shares `sendTemplateEmail` audience sync; fallback/default copy invites joining and says users can comment/rate. | May be mixed onboarding/marketing; copy may overstate write permissions. | `TBD` | `TBD` |
| Account deletion (`account-deleted`) | Sent after soft deletion when prior email is available; shares `sendTemplateEmail` audience sync. | A deletion confirmation could re-create or re-subscribe a Resend contact with `unsubscribed: false`. | `TBD` | `TBD` |
| Password changed (`password-changed`) | Sent from Clerk password update handling; shares `sendTemplateEmail` audience sync. | A security email should not cause marketing audience re-subscription. | `TBD` | `TBD` |
| Donation thank-you (`thank-you-donation`) | Sent from payment fulfillment for donation path; shares `sendTemplateEmail` audience sync. | Payment receipt/support thanks may be mixed with promotional language and provider audience sync. | `TBD` | `TBD` |
| Patron granted (`become-patron`) | Sent from payment fulfillment for patron path; shares `sendTemplateEmail` audience sync. | Patron access notification may be confused with marketing and may re-subscribe provider contact. | `TBD` | `TBD` |
| Broadcast/newsletter | Admin broadcast creates `BroadcastEmail` and recipients; preference policy checks `EmailPreference.marketingEmails`, missing preference defaults true. | Launch-critical consent and suppression gaps. | `TBD` | `TBD` |
| Manual/admin broadcast | Manual recipients can be supplied by admin input and filtered by the same email preference fallback. | Manual recipient may have no local consent/preference record yet still be eligible because missing preference defaults true. | `TBD` | `TBD` |
| Test email | Admin test email sends directly and stores test recipient in audit metadata. | Test recipient can include personal data in audit/log evidence; classification and retention unclear. | `TBD` | `TBD` |
| Support/inbound replies | Resend `email.received` stores inbound sender, recipient, subject, text, and HTML. | Inbound content retention and redaction policy unknown. | `TBD` | `TBD` |
| Moderation/incident notices | No dedicated moderation/incident template was confirmed in current inspected email templates. | Implementation unknown; future notices need category and preference policy. | `TBD` | `TBD` |

## 3. Unsubscribe semantics

| Question | Current implementation fact | Risk | Owner answer | Legal review |
| --- | --- | --- | --- | --- |
| Is one-click unsubscribe required for marketing/newsletter email? | Current email links point to `/unsubscribe?email=<encoded email>`, but no public app unsubscribe route was found; API unsubscribe requires login. | Email recipient may not be able to unsubscribe from the email link. | `TBD` | `TBD` |
| Must logged-out unsubscribe be allowed? | `DELETE /api/subscriptions` requires a signed-in user. | Logged-out recipients, deleted-account users, and different-Clerk-email users may fail to unsubscribe. | `TBD` | `TBD` |
| Does unsubscribe affect marketing only? | Resend `email.unsubscribed` handler sets `EmailPreference.marketingEmails=false`; `systemEmails` remains distinct but not actively enforced in template sending. | System/security emails and marketing emails may not be clearly separated in code or UX. | `TBD` | `TBD` |
| Should system/security emails remain enabled after marketing unsubscribe? | `systemEmails` exists with default `true`, but `sendTemplateEmail` was not found checking it. | Owner may expect security messages to continue while marketing stops; implementation currently lacks clear gate. | `TBD` | `TBD` |
| Is re-subscription allowed? | Subscribe button creates `Subscription`; no reviewed public re-subscribe preference flow was confirmed. | Re-subscribe may accidentally override provider unsubscribe/complaint without explicit confirmation. | `TBD` | `TBD` |
| Must explicit confirmation be required to re-subscribe after unsubscribe, complaint, or bounce? | `sendTemplateEmail` may create a Resend contact with `unsubscribed:false`. | Existing provider suppression could be cleared by unrelated template sends. | `TBD` | `TBD` |
| What should an invalid, expired, replayed, or unknown unsubscribe token show? | No tokenized unsubscribe flow exists. | A future flow must avoid email existence enumeration while remaining user-friendly. | `TBD` | `TBD` |

## 4. Suppression policy

| Question | Current implementation fact | Risk | Owner answer | Legal review |
| --- | --- | --- | --- | --- |
| What is the bounce policy? | Resend bounced event updates `BroadcastEmailRecipient` status to `BOUNCED`, but no global `EmailPreference` suppression was confirmed. | Future broadcasts can target the same email if preference remains enabled or missing. | `TBD` | `TBD` |
| What is the complaint policy? | Resend complained event updates `BroadcastEmailRecipient` status to `COMPLAINED`, but no global complaint suppression was confirmed. | Complaints may not prevent future marketing or template audience sync. | `TBD` | `TBD` |
| Does provider unsubscribe take precedence over local preference? | Provider unsubscribe webhook sets local `marketingEmails=false`; template sends can later attempt contact create with `unsubscribed:false`. | Precedence is unsafe/ambiguous if provider suppression can be overwritten. | `TBD` | `TBD` |
| Which source is authoritative when local preference and provider contact disagree? | Current broadcast eligibility checks local `EmailPreference`; template audience sync writes to provider; no reconciliation precedence was found. | Divergence can cause sends or provider re-subscription contrary to recipient intent. | `TBD` | `TBD` |
| Does a complaint permanently block marketing? | No global complaint model or permanent suppression flag was confirmed. | Repeat marketing after complaint would be launch-critical. | `TBD` | `TBD` |
| Does hard bounce block all delivery attempts or only marketing broadcasts? | No global bounce suppression was confirmed; template sends do not check bounce history. | Repeated sends to bouncing addresses can harm deliverability and recipient trust. | `TBD` | `TBD` |
| Should account deletion globally suppress future marketing and provider audience contact sync? | Account deletion anonymizes the user and sends account-deleted email to the prior address. | Deletion confirmation may sync the prior address back to Resend audience. | `TBD` | `TBD` |

## 5. Retention and redaction

| Question | Current implementation fact | Risk | Owner answer | Legal review |
| --- | --- | --- | --- | --- |
| How long should `BroadcastEmailRecipient.email` be retained? | Broadcast recipient records store full email addresses and delivery timestamps/status. | Retention may be longer than necessary or lack deletion/anonymization rules. | `TBD` | `TBD` |
| How long should `EmailEvent.payload` be retained? | Resend webhook handler stores full payload JSON. | Provider payload may contain personal data or message metadata beyond operational need. | `TBD` | `TBD` |
| How long should inbound email text/HTML be retained? | Inbound Resend email stores sender, recipient, subject, text, and HTML. | Support/inbound content may contain sensitive personal data. | `TBD` | `TBD` |
| What unsubscribe evidence must be retained? | `EmailPreference.unsubscribedAt` exists; no token evidence/audit model was confirmed. | Need evidence without excessive PII. | `TBD` | `TBD` |
| How long should delivery/open/click/bounce/complaint events be retained? | `EmailEvent` and `BroadcastEmailRecipient` retain event and status data. | Retention and minimization policy unknown. | `TBD` | `TBD` |
| Should logs redact full email addresses and provider identifiers? | Current logs can include full recipient emails, Resend IDs, audience IDs, provider errors, and test email addresses. | Logs may expose personal data or provider identifiers. | `TBD` | `TBD` |

## 6. User experience

| Question | Current implementation fact | Risk | Owner answer | Legal review |
| --- | --- | --- | --- | --- |
| Should unsubscribe/preference UX support Polish and English? | Email templates have Polish/English variants; no public unsubscribe page was found. | Recipient may receive a localized email but no matching localized unsubscribe confirmation. | `TBD` | `TBD` |
| What should successful unsubscribe confirmation copy say? | No public logged-out unsubscribe route was found. | Future generic response needs approved wording. | `TBD` | `TBD` |
| What should already-unsubscribed copy say? | No idempotent unsubscribe UX exists. | Repeat link use should not reveal account existence or create confusion. | `TBD` | `TBD` |
| What should invalid/expired token copy say? | No tokenized unsubscribe flow exists. | Need generic no-enumeration copy. | `TBD` | `TBD` |
| What contact/support route should failed unsubscribe users use? | Inbound email storage exists, but no audited support route policy was established in this pack. | Users need a fallback if unsubscribe link fails. | `TBD` | `TBD` |
| What preference-settings route should emails link to? | Current `preferencesLink` points to `/profile/settings`; no route was found during requested discovery. | Email may link to a missing or auth-required settings page. | `TBD` | `TBD` |

## 7. Required owner decisions before LAUNCH-EMAIL-002

- Approved marketing-vs-transactional classification for every current template and broadcast surface.
- Approved explicit consent model for signup, support/payment, PatronGrant, and manual/admin recipients.
- Approved unsubscribe semantics, including logged-out unsubscribe and one-click behavior.
- Approved suppression precedence across local preference, provider contact state, bounce, complaint, account deletion, and re-subscription.
- Approved retention/redaction policy for logs, provider payloads, recipient records, inbound content, and evidence.
- Decision whether schema changes are allowed for secure token/suppression implementation.
- Legal review decision before public marketing delivery or public launch claims.
