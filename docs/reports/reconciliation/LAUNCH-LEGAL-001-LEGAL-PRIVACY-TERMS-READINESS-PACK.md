# LAUNCH-LEGAL-001 — Legal, privacy, terms and public-policy readiness pack

## 1. Executive summary

Status: READY_FOR_OWNER_REVIEW.

This docs-only readiness pack inventories current public legal/privacy/policy surfaces and compares them with current-main implementation evidence, `AGENTS.md`, and owner decisions. It does not provide legal advice, does not publish final legal copy, does not mark legal documents approved, and does not unblock public launch.

Highest-risk findings:

- Current terms copy describes patron qualification using historical/lifetime aggregate payments and tier wording that no longer matches current policy and runtime.
- Current terms copy says all payments are non-refundable, but runtime supports refunds and dispute-driven access changes.
- Current terms copy says logged-in users may comment, while current patron-only comment writing/reaction/reporting follows video access and requires patron/admin access for patron-only content.
- Current privacy copy says data is shared only with Clerk and Stripe and uses absolute/unsupported security language, while runtime evidence includes Cloudflare Stream, Vercel/deployment config, PostgreSQL, Resend/email, operational logging, rate limiting, and browser cookie/localStorage behavior.
- Current privacy copy claims traffic analytics cookies, but no first-party analytics SDK/pixel was found in inspected code; there is also no cookie banner/preference mechanism found.
- Footer currently lacks legal/privacy/cookie/support links; checkout/support surfaces have partial links but not a complete owner-approved disclosure set.
- Controller/business identity, address, tax status, legal basis, retention, transfer/location, DPA/contract status, jurisdiction, age requirement, refund/support process, and final legal-copy source remain unknown.

Final legal publication remains BLOCKED through `LAUNCH-BLOCKED-001` and proposed future ticket `LAUNCH-LEGAL-002`.

## 2. Baseline main SHA

Baseline inspected SHA: `cd6e9f9638e47d90a263d4be85b760c584e2d6a1`.

Remote refresh note: `git fetch origin main` could not run because this checkout has no `origin` remote. The only local branch at task start was `work`; `LAUNCH-LEGAL-001-legal-privacy-terms-readiness-pack` was created from the local current baseline SHA above.

## 3. Scope and legal disclaimer

Scope:

- Docs-only preparation and analysis.
- Read-only inspection of application/runtime/docs evidence.
- Creation of the ready ticket, owner questionnaire, publication checklist, reconciliation report, and exactly one future blocked implementation ticket.

Legal disclaimer:

- This report is not legal advice.
- It does not provide final legal copy.
- It does not determine legal compliance.
- It does not mark any document as counsel-reviewed or public-launch ready.
- Unknown legal/business facts are explicitly marked `OWNER_DECISION_REQUIRED`, `LEGAL_REVIEW_REQUIRED`, or `IMPLEMENTATION_UNKNOWN`.

## 4. Legal surface inventory

| Surface | Route/component | Exists | Current claim summary | Runtime evidence | Problem | Classification | Owner input | Legal review | Future implementation path |
| ------- | --------------- | -----: | --------------------- | ---------------- | ------- | -------------- | ----------- | ------------ | -------------------------- |
| Terms / regulamin | `app/regulamin/page.tsx` | Yes | Private author video channel; lifetime patronage tied to total support; tiers GUEST/LOGGED_IN/PATRON; no refunds; logged-in commenting; creator may change rules/tiers. | Page text includes historical sum/Lifetime Total, `≥ 20 PLN`, non-refundable payments, and logged-in commenting. Runtime uses active PatronGrant for patron access and configurable 10-unit thresholds. | Multiple stale/false claims and missing refund/dispute/suspension distinctions. | STALE_OR_FALSE_CLAIM / MISSING_DISCLOSURE | Exact terms model, access wording, refund/support process. | Required for consumer/payment/access wording. | Future `LAUNCH-LEGAL-002` may update `app/regulamin/page.tsx` only after unblock. |
| Privacy policy | `app/polityka-prywatnosci/page.tsx` | Yes | Clerk auth, Stripe payments, data used exclusively for service/premium/contact, never shared beyond Clerk/Stripe, cookies for session/security and traffic analytics, contact email. | Runtime evidence includes Clerk, Stripe, Cloudflare Stream, Vercel config, PostgreSQL, Resend, logs, rate limiting, referral cookie, language localStorage. | Processor/recipient list incomplete; absolute claims unsupported; analytics language ambiguous/unsupported. | UNSUPPORTED_ABSOLUTE_CLAIM / MISSING_DISCLOSURE | Controller identity, contact, provider approval, retention. | Required for lawful basis, rights, transfers, retention, security claims. | Future `LAUNCH-LEGAL-002` may update `app/polityka-prywatnosci/page.tsx`. |
| Cookie notice | Privacy page section only | Partial | Necessary cookies for session/security and analytics cookies for traffic improvement. | Referral cookie `clerk_referrer_id` is set for 30 days; `app-language` localStorage stores preference; Clerk/Stripe may set auth/payment cookies; no analytics SDK found. | No standalone cookie notice; analytics claim unsupported/ambiguous; no mechanism details. | MISSING_DISCLOSURE / IMPLEMENTATION_UNKNOWN | Analytics intent, cookie categories, external embeds. | Required for consent/legal basis and wording. | Future cookie notice/page/component if owner/legal review requires. |
| Cookie consent/banner | none found | No | No banner/preference UI found. | Search found no consent component or preference storage. | If optional cookies/tracking are used, implementation may be missing; no legal conclusion made. | IMPLEMENTATION_UNKNOWN / LEGAL_REVIEW_REQUIRED | Decide if required and for which mechanisms. | Required before deciding necessity. | Future cookie banner/preferences if required. |
| Payment/checkout disclosure | `app/components/playlist/SupportBox.tsx`, `CheckoutModal.tsx`, `/api/checkout*` | Partial | Support box requires accepting terms and privacy before support; checkout says one-time tip and Stripe. | Checkout API validates logged-in user, amount/currency; creates Stripe PaymentIntent; fulfillment creates PatronGrant only if eligible. | Partial disclosure exists, but current linked terms/privacy are stale and no final refund/support wording. | MISSING_DISCLOSURE | Final pre-payment wording and support/refund contact. | Required for payment/consumer wording. | Future checkout/support disclosure components. |
| Support/refund disclosure | no public support/refund page found; privacy contact email | Partial/No | Terms says no refunds; privacy page gives email for data matters. | Runtime handles full refunds, partial refunds, disputes; no public refund/support process found. | Current no-refund claim conflicts with runtime; support process absent. | STALE_OR_FALSE_CLAIM / MISSING_DISCLOSURE | Refund/support process, response timeframe, partial refund policy. | Required for consumer refund/statutory rights. | Future support/refund policy route/component. |
| Patron-access explanation | Terms, support box, checkout modal, admin diagnostics | Partial | Terms uses tiers and lifetime total; UI says support channel and become Patron; checkout success says webhook confirmation gives Patron status. | Fulfillment checks configurable currency threshold and creates PatronGrant; access reads active grants. | Public copy fails to distinguish Payment, PatronGrant, Subscription and exceptions. | STALE_OR_FALSE_CLAIM / MISSING_DISCLOSURE | Exact lifetime/no-expiry wording and revocation grounds. | Required for access/benefit wording. | Future terms/checkout/patron help copy. |
| Newsletter consent | `SubscribeButton`, `/api/subscriptions` | Partial | Subscribe/unsubscribe for channel email notifications. | Subscription use-cases return `purpose: EMAIL_NOTIFICATIONS`; no PatronGrant mutation. | Needs public consent copy and unsubscribe/preference route clarity. | MISSING_DISCLOSURE | Newsletter consent model and marketing vs transactional boundaries. | Required for email/privacy/cookie copy. | Future newsletter consent/unsubscribe surfaces. |
| Unsubscribe | API DELETE and email template links; no `/unsubscribe` page found | Partial | Email service generates `/unsubscribe?email=...`; API DELETE requires logged-in user. | No route file found under `app/**/unsubscribe*`; templates may include link. | Public unsubscribe link destination appears unimplemented/unknown. | IMPLEMENTATION_UNKNOWN / MISSING_DISCLOSURE | Confirm desired unsubscribe/preference UX. | Required for email consent/suppression wording. | Future unsubscribe/preference implementation if needed. |
| Contact | privacy email only | Partial | Privacy contact email `pawel.perfect@gmail.com` for data matters. | No contact/support page found. | Business/controller/support/copyright/security contacts unknown. | OWNER_DECISION_REQUIRED / MISSING_DISCLOSURE | Official contact identities and routes. | Required for privacy/support/legal notices. | Future contact/support page or disclosures. |
| Account deletion/data request | no public route found | No/Unknown | Privacy page does not describe rights/deletion process. | Email template has account-deleted fallback, but no public data-request process found. | Missing public process and retention/effect details. | MISSING_DISCLOSURE / OWNER_DECISION_REQUIRED | Data request/deletion process and contact. | Required for privacy rights wording. | Future privacy/account support copy and route. |
| Footer links | `app/components/Footer.tsx` | Footer exists | Shows brand/domain only. | No legal/privacy/cookie/support links in footer component. | Missing discoverable legal links. | MISSING_DISCLOSURE | Decide exact footer links. | Legal review for required placements. | Future footer update after copy unblock. |
| Registration/login disclosure | Clerk modal via `SignInButton`; middleware | Partial/Unknown | Navbar opens Clerk sign-in modal; public app pages routed through Clerk middleware. | No local signup terms/privacy disclosure found beyond Clerk integration. | Disclosure placement depends on final owner/legal decision and Clerk UI behavior. | IMPLEMENTATION_UNKNOWN / LEGAL_REVIEW_REQUIRED | Signup/login placement requirements. | Required for consent/terms acceptance. | Future signup/login disclosure if required. |
| Comments/community rules | Terms and comments runtime | Partial | Terms says logged-in commenting; lawful/non-infringing use. | Runtime comments publicly readable for patron/login barriers; writes/reactions/reports inherit access; guest cannot write/report. | Public rules do not match patron-only write rule and lack moderation/reporting process. | STALE_OR_FALSE_CLAIM / MISSING_DISCLOSURE | Community rules and moderation rights. | Required for sanctions, reports, prohibited content. | Future community/comment rules copy. |
| Moderation/reporting | admin routes/use-cases | Runtime exists | Not meaningfully described in public legal copy. | Report/comment moderation use-cases and audit exist; guests cannot report. | Public copy missing report/moderation/removal explanation. | MISSING_DISCLOSURE | Report process, appeal/contact path. | Required for community-policy wording. | Future rules/support copy. |
| Private-video access notice | player/access runtime and UI lock states | Partial | UI can show patron-required/locked states; current terms use tiers. | PlaybackPlan denies without source; Cloudflare token only after access allowed. | Public legal copy needs clear statement that signed playback URLs/tokens are short-lived and not public media URLs. | MISSING_DISCLOSURE | Owner wording for access boundaries. | Review for digital-content/access language. | Future terms/private-video notice. |
| Document version/effective date | terms/privacy pages | No | No visible version/effective date found. | Legal pages have headings and sections only. | Version/effective date missing. | MISSING_DISCLOSURE / OWNER_DECISION_REQUIRED | Effective date/versioning process. | Required before publication. | Future legal pages. |

## 5. Current terms contradiction matrix

| Current terms claim | Actual product/runtime behavior | Risk | Recommended replacement concept, not final copy | Required owner decision | Required legal review |
| --- | --- | --- | --- | --- | --- |
| Access to digital content depends on total support amount. | Owner decisions: patronat is reward for qualifying one-time support; runtime creates PatronGrant for an eligible payment and reads active grants for access. | Users may believe cumulative/historical totals or payment totals alone grant access. | Explain Payment as support event, PatronGrant as access status, and active PatronGrant as access truth. | Confirm public framing of support/donation/tip/reward. | Review consumer/digital-content characterization. |
| Users unlock tiers based on historical sum of payments / Lifetime Total. | Current access truth is active PatronGrant; legacy mixed-currency aggregate is marked do-not-use in schema comments, and access checks active grants. | Stale access model; mixed-currency/cumulative confusion. | Remove cumulative lifetime-total model; explain qualifying one-time support and configured thresholds. | Confirm if any cumulative policy should ever exist; current policy says no. | Review wording for pricing/eligibility clarity. |
| LOGGED_IN tier allows commenting and liking. | Comments under patron-only content are publicly readable, but writing/reacting/reporting requires video access; patron-only requires patron/admin. | Misstates community permissions and may invite denied actions. | Distinguish public reading from writing/reacting/reporting permissions. | Confirm if reactions are in launch scope. | Review community-rule wording. |
| PATRON requires one-time payment above current threshold, example `≥ 20 PLN`. | Launch defaults are 10 PLN, 10 USD, 10 EUR, 10 CHF, 10 GBP; thresholds are admin-configurable per currency. | Stale price/threshold and single-currency example. | State thresholds are configurable per currency and display current values dynamically or owner-approved launch values. | Confirm currencies/countries and public threshold display. | Review price/payment disclosure. |
| All payments processed by Stripe are non-refundable. | Runtime supports full refunds, partial refunds, disputed payments, chargeback lost/won states. Full refund revokes linked grant; dispute opened can suspend; dispute won can restore matching suspension; dispute lost revokes linked access. | Direct contradiction; potentially high support/legal risk. | Explain support/refund process and access consequences without absolute no-refund language. | Refund-support process, response time, partial-refund access policy. | Statutory/consumer refund rights and final wording. |
| Payment gives access to specific service sections. | Payment alone is not access truth; fulfillment evaluates eligibility and creates PatronGrant. | Payment-alone shortcut in public copy. | Explain access starts after payment confirmation/webhook and PatronGrant creation. | Confirm user-facing status messages for pending/failed webhooks. | Review delayed-access/payment-status wording. |
| Once unlocked, access level is assigned permanently/lifetime. | Owner decision: lifetime/no-expiry by default unless suspended/revoked by policy. Runtime revokes/suspends on full refund/dispute and supports manual revoke. | Unconditional lifetime promise ignores exceptions. | State default no-expiry while reserving owner-approved exceptions: full refund, dispute/chargeback, abuse/fraud, security/legal obligations, manual policy action. | Exact lifetime wording and revocation grounds. | Review enforceability and consumer rights. |
| Privacy/account section says commenting requires login. | For patron-only content, login alone is insufficient for writing/reacting/reporting; comments are public-read. | Contradiction with current permission model. | Replace with route/tier-specific community rules. | Community moderation/reporting policy. | Review community terms. |
| Creator may change rules and access tiers; use after changes means acceptance. | Product policy no longer emphasizes tier changes; launch legal copy lacks version/effective date and update process. | Broad unilateral-change wording may be incomplete/unsupported. | Add owner-approved update/version/effective-date process and notice path. | Update notice/versioning cadence. | Review change-acceptance wording. |

## 6. Current privacy contradiction matrix

| Current privacy claim or omission | Evidence-based issue | Classification | Recommended replacement concept, not final copy | Owner decision required | Legal review required |
| --- | --- | --- | --- | --- | --- |
| Clerk manages registration/login/profile data. | Clerk use is evidenced by middleware, auth APIs, and Clerk components. | VERIFIED_CURRENT_FACT | Keep provider disclosure, but add controller/provider role and links only after review. | Confirm provider list. | Processor/subprocessor and transfer wording. |
| Stripe exclusively processes financial operations. | Stripe SDK/API routes/webhook are evidenced; app stores Payment records and Stripe IDs. | VERIFIED_CURRENT_FACT / MISSING_DISCLOSURE | Disclose Stripe plus local payment records and webhook ledger. | Payment record retention/contact. | Payment/legal-basis/retention wording. |
| Site does not store card data or direct bank details. | Code uses Stripe Elements/PaymentIntent; no card storage in repo evidence. | VERIFIED_CURRENT_FACT with caution | Avoid absolute security guarantees; state based on implementation and Stripe role after review. | Confirm final copy. | Security/payment wording. |
| “Stripe guarantees highest security.” | Absolute third-party security guarantee is unsupported by repo evidence. | UNSUPPORTED_ABSOLUTE_CLAIM | Replace with neutral processor/security-process wording. | None unless owner wants exact phrasing. | Required. |
| Data used exclusively for service/premium/contact. | Runtime also includes logs, rate limiting, video playback sessions, email delivery, support/admin operations, comments, referrals, webhooks. | UNSUPPORTED_ABSOLUTE_CLAIM / MISSING_DISCLOSURE | List purposes/categories accurately. | Confirm purposes and retention. | Lawful bases and rights. |
| Data never shared beyond Clerk and Stripe. | Evidence includes Cloudflare Stream, Vercel/deployment config, PostgreSQL, Resend, possible Upstash/KV rate-limit store, logs/monitoring. | STALE_OR_FALSE_CLAIM | Replace with evidence-based recipient/provider inventory after owner review. | Approve provider list. | Processor/subprocessor/transfer/DPA wording. |
| Cookies used for session/security and analytics. | Referral cookie and language localStorage found; no first-party analytics SDK/pixel found. Clerk/Stripe may set cookies. | UNSUPPORTED_ABSOLUTE_CLAIM / IMPLEMENTATION_UNKNOWN | Separate necessary/auth/payment/referral/preference mechanisms from optional analytics, if any. | Analytics/cookie intent. | Consent/cookie legal analysis. |
| Contact email for data matters. | Email exists, but controller/business identity and official data-request route are unknown. | OWNER_DECISION_REQUIRED | Use owner-approved contact and process. | Official contact/controller identity. | Privacy rights and contact wording. |
| Missing controller identity. | No legal entity/address found. | MISSING_DISCLOSURE / OWNER_DECISION_REQUIRED | Placeholder only: `[OWNER DECISION REQUIRED: controller identity]`. | Required. | Required. |
| Missing rights/retention/deletion/legal bases/changes. | Current page lacks these sections. | MISSING_DISCLOSURE | Add sections after owner/legal answers. | Retention/deletion/contact/versioning. | Required. |

## 7. Cookie/tracking implementation truth

| Mechanism | Evidence | Necessary/optional candidate | Consent currently present | Disclosure currently present | Status |
| --------- | -------- | ---------------------------- | ------------------------- | ---------------------------- | ------ |
| Clerk authentication cookies/session | Clerk middleware and components protect routes/auth users. | Necessary candidate for auth/session; legal conclusion not made. | No local consent banner found. | Privacy page mentions necessary cookies for session/security. | VERIFIED_CURRENT_FACT / LEGAL_REVIEW_REQUIRED |
| Stripe Elements/payment cookies or storage | Stripe client dependencies and checkout modal with `Elements`; payment APIs use Stripe. | Payment/necessary candidate; legal conclusion not made. | No local consent banner found. | Privacy page mentions Stripe, not Stripe browser cookies/storage details. | VERIFIED_CURRENT_FACT / MISSING_DISCLOSURE |
| Referral cookie `clerk_referrer_id` | `ReferralTracker` sets cookie for 30 days when `ref` query param exists and clears it after claim/error states. | Referral/functional/marketing classification requires review. | No consent banner found. | Not disclosed by current privacy/cookie section. | VERIFIED_CURRENT_FACT / MISSING_DISCLOSURE / LEGAL_REVIEW_REQUIRED |
| Language preference localStorage `app-language` | `LanguageContext` reads/writes localStorage. | Preference/functional candidate; legal conclusion not made. | No consent banner found. | Not disclosed in current privacy/cookie section. | VERIFIED_CURRENT_FACT / MISSING_DISCLOSURE |
| First-party analytics SDK/pixel | Search found no `gtag`, Plausible, PostHog, Mixpanel, Meta pixel, or analytics package usage. | NOT_APPLICABLE unless owner intends analytics. | No consent banner found. | Privacy page claims analytics cookies. | UNSUPPORTED_ABSOLUTE_CLAIM / IMPLEMENTATION_UNKNOWN |
| Operational logs | Logger exists and redacts sensitive key patterns; Vercel/log monitoring appears in operations docs. | Operational/security candidate; legal conclusion not made. | Not applicable as cookie consent; privacy disclosure still needed. | Not disclosed in current privacy page. | VERIFIED_CURRENT_FACT / MISSING_DISCLOSURE |
| Rate-limit store cookies/storage | Rate limiting uses server-side keys; production env validates Upstash/KV REST credentials. | Server-side operational candidate. | Not cookie consent. | Not disclosed. | VERIFIED_CURRENT_FACT / MISSING_DISCLOSURE |
| YouTube nocookie embeds | Media policy allows `youtube-nocookie.com`; current active private provider is Cloudflare Stream. | External embed candidate if used. | No local consent banner found. | Not disclosed. | IMPLEMENTATION_UNKNOWN / LEGAL_REVIEW_REQUIRED |
| Cookie banner/preferences | No consent component/preference storage found. | Required/not required cannot be determined by agent. | No. | No. | IMPLEMENTATION_UNKNOWN / LEGAL_REVIEW_REQUIRED |

## 8. Provider/data-processing inventory

| Provider/system | Verified purpose | Data categories | Trigger | Retention evidence | Transfer/location evidence | Contract/DPA evidence | User-facing disclosure needed | Status |
| --------------- | ---------------- | --------------- | ------- | ------------------ | -------------------------- | --------------------- | ----------------------------- | ------ |
| Clerk | Authentication, route protection, user/session identity, Clerk webhooks. | Auth identifiers, email/name/profile claims, session metadata; exact categories need provider review. | Sign-in/sign-up/session, webhook sync. | Not evidenced in repo. | Not evidenced in repo. | Not evidenced in repo. | Auth provider, account data, cookies/session, rights/contact. | VERIFIED_CURRENT_FACT / LEGAL_REVIEW_REQUIRED |
| Stripe | PaymentIntent creation, webhooks, refunds/disputes, payment records. | Payment amount/currency/status, Stripe IDs, customer/payment intent IDs; app does not evidence card storage. | Checkout, payment webhook, refund/dispute webhook. | Local retention not evidenced. | Not evidenced in repo. | Not evidenced in repo. | Payment processor plus local payment records and refund/dispute effects. | VERIFIED_CURRENT_FACT / LEGAL_REVIEW_REQUIRED |
| Cloudflare Stream | Direct upload/import/webhook and signed private playback delivery. | Video asset IDs, playback token/URL, playback session metadata in app; exact Cloudflare categories unknown. | Admin upload/import, Cloudflare webhook, allowed playback plan. | Cloudflare retention not evidenced; app stores asset/session records. | Not evidenced in repo. | Not evidenced in repo. | Video delivery provider, signed short-lived playback, private media access. | VERIFIED_CURRENT_FACT / MISSING_DISCLOSURE |
| Vercel | Build/deploy host indicated by `vercel.json` and package `vercel-build`; operations docs reference Vercel logs. | Deployment/build/runtime logs may include operational data; exact categories unknown. | Deployment and runtime hosting. | Not evidenced in repo. | Not evidenced in repo. | Not evidenced in repo. | Hosting/deployment/logging recipient disclosure. | VERIFIED_CURRENT_FACT / MISSING_DISCLOSURE |
| PostgreSQL/database provider | Prisma datasource provider is PostgreSQL; `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are production env requirements. | Users, payments, PatronGrants, subscriptions, comments, audit logs, video records, email templates/events. | Application runtime and admin/support actions. | Schema timestamps exist, but retention periods not evidenced. | Physical provider/location not evidenced. | Not evidenced in repo. | Database storage, data categories, retention, deletion. | VERIFIED_CURRENT_FACT / OWNER_DECISION_REQUIRED |
| Resend/email provider | Email service sends transactional/patron/thank-you/broadcast/template emails; Resend webhook route exists. | Email address, email content/templates, delivery events; exact categories unknown. | Payment fulfillment emails, admin broadcasts/templates, delivery webhooks. | Not evidenced in repo. | Not evidenced in repo. | Not evidenced in repo. | Email provider, transactional vs marketing, unsubscribe/suppression. | VERIFIED_CURRENT_FACT / MISSING_DISCLOSURE |
| Operational logs/monitoring | Logger, alert/metric calls, operations monitoring checklist. | Request IDs, event metadata, hashed IP/UA for playback sessions; exact log sinks unknown. | API errors, webhooks, playback, refunds/disputes, emails. | Not evidenced in repo. | Not evidenced in repo. | Not evidenced in repo. | Operational logging/monitoring disclosure, security purpose, retention. | VERIFIED_CURRENT_FACT / MISSING_DISCLOSURE |
| Cookies | Clerk/session, referral cookie; third-party payment/auth cookies possible. | Cookie identifiers/session/referral code; exact Clerk/Stripe cookies unknown. | Auth, referral link, payment flow. | Referral cookie 30 days in code; others not evidenced. | Not evidenced in repo. | Not evidenced in repo. | Cookie notice/categories and preference/consent if required. | VERIFIED_CURRENT_FACT / LEGAL_REVIEW_REQUIRED |
| Browser local/session storage | `app-language` localStorage. No sessionStorage found. | Language preference. | Language selection/initialization. | Until user/browser clears; no app retention policy evidenced. | Browser-local. | Not applicable/unknown. | Storage notice if required. | VERIFIED_CURRENT_FACT / MISSING_DISCLOSURE |
| Support email | Current privacy page lists `pawel.perfect@gmail.com` for data matters. | Support/data-request correspondence; exact categories unknown. | User emails/contact. | Not evidenced. | Not evidenced. | Not evidenced. | Official contact/support/data-request disclosure. | OWNER_DECISION_REQUIRED |
| GitHub/Vercel deployment logs | Vercel config and operations docs reference deployment/log monitoring; GitHub workflows not inspected as modified paths are forbidden but read-only search allowed. | Build/deploy logs, commit metadata, error traces; exact categories unknown. | Deploy/build/runtime errors. | Not evidenced. | Not evidenced. | Not evidenced. | Operational/deployment logs if user data can enter logs. | IMPLEMENTATION_UNKNOWN / MISSING_DISCLOSURE |
| Backup/restore systems | Operations docs include database backup/restore drill templates using restore URLs. | Database backups may contain all application data. | Backup/restore drills/operations. | Retention/location/provider not evidenced. | Not evidenced. | Not evidenced. | Backup retention and restore disclosure/operations owner. | IMPLEMENTATION_UNKNOWN / OWNER_DECISION_REQUIRED |
| Upstash/KV rate-limit store | Env validation requires writable Redis/KV REST credentials in production. | Rate-limit keys (user/IP/media/request context), exact store unknown. | Rate limiting. | Not evidenced. | Not evidenced. | Not evidenced. | Operational provider disclosure if used in production. | VERIFIED_CURRENT_FACT / IMPLEMENTATION_UNKNOWN |

## 9. Refund/support policy gap

Verified runtime facts:

- Full refund updates payment refund status and calls `revokePatron` with the linked `paymentId`.
- Partial refund updates `PARTIALLY_REFUNDED` and recalculates patron status; owner OQ-001 remains open for policy.
- Dispute opened marks payment `DISPUTED` and revokes/suspends linked active grants with a temporary dispute reason.
- Dispute won only reactivates grants revoked for the matching dispute reason.
- Dispute lost/chargeback marks `CHARGEBACK_LOST`, decrements totals, and revokes linked grants.

Gap:

- Current terms say payments are non-refundable.
- No public support/refund process, official support route, response timeframe, partial-refund policy, or statutory-right wording is evidenced.
- Final copy requires OWNER_DECISION_REQUIRED and LEGAL_REVIEW_REQUIRED.

## 10. Patron/access wording gap

Verified policy/runtime facts:

- Polutek.pl is one creator's VOD/community place, not a marketplace/platform.
- Patronat is not recurring subscription; it is a reward/benefit for qualifying one-time support/donation.
- Active PatronGrant is the backend access truth for patron-only access.
- Payment alone, newsletter Subscription, Clerk metadata, `User.isPatron`, and frontend state are not backend access truth.
- Launch default thresholds are 10 PLN, 10 USD, 10 EUR, 10 CHF, 10 GBP and are configurable per currency.
- Lifetime/no-expiry is default owner policy, subject to suspension/revocation by policy.

Gap:

- Current terms rely on tier/lifetime total/payment-total wording and do not explain PatronGrant.
- Public wording must include exceptions: full refund, dispute/chargeback, abuse/fraud, manual policy action, legal/security obligations, and unresolved partial-refund policy.

## 11. Comments/community wording gap

Verified policy/runtime facts:

- Comments under published patron-only videos are publicly readable.
- Guest users cannot write/report.
- Writing/reactions/reporting inherit video access; for patron-only content this means patron/admin access.
- Moderation/reporting/admin actions exist, but public community rules are incomplete.

Gap:

- Current terms say commenting requires login, which is incomplete/false for patron-only writing and reporting.
- Final copy needs public reading vs writing/reacting/reporting distinction, moderation/reporting/removal rights, prohibited content, appeal/contact path, and sanctions/access consequences only after owner/legal review.

## 12. Missing controller/business identity facts

OWNER_DECISION_REQUIRED:

- Legal name/individual or entity identity.
- Business/trading name and registration/tax details if applicable.
- Address or legally acceptable contact address.
- Official support/refund/data-request/security/copyright contact.
- Controller identity.
- Jurisdiction/governing law/court, if any.
- Required languages and effective date/version.

No values are inferred or invented in this pack.

## 13. Owner decision questionnaire summary

Created: `docs/operations/legal-owner-decision-questionnaire.md`.

It asks directly answerable questions grouped by:

- Identity.
- Product/payment.
- Access.
- Privacy.
- Cookies.
- Content/community.
- Review/publication.

Each question includes why it is needed, current known fact, a reminder that defaults are not assumed, owner answer field, and legal-review field.

## 14. Legal review questions

LEGAL_REVIEW_REQUIRED before final publication:

- Consumer/payment characterization for support/donation/tip/reward/digital-content access.
- Refund/statutory rights and no-refund replacement wording.
- Lawful bases for account, payment, comment, support, email, playback, logging, and analytics/referral processing.
- Controller/processor/subprocessor roles, DPA status, international transfer wording, and provider links.
- Cookie consent/preference requirements for Clerk, Stripe, referral cookie, localStorage, analytics if introduced, and external embeds.
- User rights, deletion, retention, and payment/account record retention.
- Lifetime/no-expiry access wording with exceptions.
- Community moderation/reporting/sanction wording.
- Change-notice/versioning/effective-date process.
- Signup/checkout/footer placement requirements.

## 15. Draft document structures

These are structures and placeholders only, not final legal copy.

### Terms of Use structure

Required sections:

1. Operator/service identity — `[OWNER DECISION REQUIRED: controller/operator identity]`.
2. Product identity — verified fact: one creator VOD/community place, not platform/marketplace.
3. Account/authentication — verified fact: Clerk handles authentication.
4. One-time support/payment model — verified fact: Stripe handles payments; patronat is not recurring subscription.
5. PatronGrant/access model — verified fact: active PatronGrant is access truth.
6. Thresholds/currencies — verified fact: configurable per currency; launch defaults 10 PLN/USD/EUR/CHF/GBP.
7. Access duration/exceptions — `[OWNER DECISION REQUIRED: exact lifetime wording]`; `[LEGAL REVIEW REQUIRED: enforceability/exceptions]`.
8. Refunds/disputes/support — `[OWNER DECISION REQUIRED: refund-support process]`; `[LEGAL REVIEW REQUIRED: consumer refund rights]`.
9. Comments/community conduct — verified fact: public read, patron/admin write for patron-only; `[OWNER DECISION REQUIRED: rules]`.
10. Moderation/reporting/sanctions — `[OWNER DECISION REQUIRED: appeal/contact path]`; `[LEGAL REVIEW REQUIRED: sanctions wording]`.
11. Private video/playback restrictions — verified fact: signed playback tokens are short-lived and not public URLs.
12. Changes/version/effective date — `[OWNER DECISION REQUIRED: effective date/versioning]`.
13. Governing law/dispute forum — `[LEGAL REVIEW REQUIRED: jurisdiction/governing law]`.

Implementation destinations: `app/regulamin/page.tsx`, checkout/support/signup disclosure components, footer links.

### Privacy Policy structure

Required sections:

1. Controller identity/contact — `[OWNER DECISION REQUIRED: controller identity]`.
2. Scope and service description.
3. Data categories: account/profile, payment records, PatronGrant/access, comments/reports, subscriptions/email, support correspondence, playback/session logs, operational logs, cookies/storage.
4. Purposes — `[LEGAL REVIEW REQUIRED: lawful basis per purpose]`.
5. Providers/recipients: Clerk, Stripe, Cloudflare Stream, Vercel, PostgreSQL/database provider, Resend, logs/monitoring, rate-limit store if used, backup systems if used.
6. Retention — `[OWNER DECISION REQUIRED: retention period]`; `[LEGAL REVIEW REQUIRED: payment/account retention]`.
7. User rights/data request process — `[OWNER DECISION REQUIRED: data-request contact]`.
8. Account deletion/comment deletion/support records.
9. Security — neutral implementation-based wording only; no absolute guarantees.
10. International transfers — `[LEGAL REVIEW REQUIRED: transfer mechanism]`.
11. Cookies/storage cross-reference.
12. Changes/effective date/version.

Implementation destinations: `app/polityka-prywatnosci/page.tsx`, contact/data request route or support component, footer.

### Cookie Notice structure

Required sections:

1. What cookies/storage are used.
2. Necessary/auth/payment/session mechanisms: Clerk and Stripe as reviewed.
3. Referral cookie `clerk_referrer_id` — verified 30-day code behavior; `[LEGAL REVIEW REQUIRED: category/consent basis]`.
4. Language localStorage `app-language` — preference behavior.
5. Analytics — `[OWNER DECISION REQUIRED: analytics provider or no analytics]`.
6. External embeds/providers: Cloudflare Stream, Stripe, Clerk, YouTube-nocookie if used.
7. Consent/preferences — `[OWNER DECISION REQUIRED: preference mechanism]`; `[LEGAL REVIEW REQUIRED: consent requirement]`.
8. Effective date/version.

Implementation destinations: future cookie page/component/banner/preferences if required, footer link, privacy cross-reference.

### Refund and Support Policy structure

Required sections:

1. Support contact — `[OWNER DECISION REQUIRED: support contact]`.
2. Payment model summary — verified fact: one-time support via Stripe.
3. Patron reward/access timing — verified fact: PatronGrant after eligible confirmed payment.
4. Refund request process — `[OWNER DECISION REQUIRED: process/timeframe]`.
5. Full refund access effect — verified fact: linked PatronGrant can be revoked.
6. Partial refund policy — `[OWNER DECISION REQUIRED: partial refund policy]`.
7. Disputes/chargebacks — verified fact: opened can suspend, won may restore matching suspension, lost revokes linked access.
8. Statutory rights — `[LEGAL REVIEW REQUIRED: consumer refund rights]`.
9. Abuse/fraud/security exceptions — `[OWNER DECISION REQUIRED: grounds]`; `[LEGAL REVIEW REQUIRED: wording]`.

Implementation destinations: future support/refund route or terms subsection, checkout disclosure, payment success/failure support copy.

### Community/Comment Rules structure

Required sections:

1. Comment visibility — verified fact: public read under published videos including patron-only.
2. Comment permissions — verified fact: writing/reacting/reporting requires access; patron-only requires patron/admin.
3. Prohibited content — `[OWNER DECISION REQUIRED: prohibited content list]`.
4. Reporting process — verified fact: report use-case exists for eligible users; `[OWNER DECISION REQUIRED: response path]`.
5. Moderation actions — verified fact: hide/delete/restore/dismiss/admin queues exist; `[LEGAL REVIEW REQUIRED: rights/sanctions wording]`.
6. Appeals/contact — `[OWNER DECISION REQUIRED: appeal/contact path]`.
7. Account/access sanctions — `[OWNER DECISION REQUIRED: grounds]`; `[LEGAL REVIEW REQUIRED: proportionality/notice wording]`.
8. Effective date/version.

Implementation destinations: future community rules page/section, comment UI links, terms cross-reference.

## 16. Publication locations

Future publication locations to decide:

- Terms: `/regulamin`.
- Privacy: `/polityka-prywatnosci`.
- Cookie notice/preferences: owner/legal decision required.
- Refund/support/contact: owner decision required.
- Community/comment rules: owner decision required.
- Footer: needs legal/privacy/cookie/support/contact links.
- Checkout/support box: needs terms/privacy/refund/support disclosure before payment.
- Signup/login: needs disclosure placement if required.
- Newsletter/unsubscribe/preference route: needs owner/legal decision and implementation if missing.

## 17. Publication checklist

Created: `docs/operations/legal-privacy-terms-publication-checklist.md`.

It separates:

- Content approval readiness.
- Implementation readiness.
- Production evidence readiness.

Final publication remains blocked until the checklist's content approval and implementation prerequisites are resolved by owner-authorized follow-up work.

## 18. Existing blocker status

Existing blocker inspected: `docs/tickets/blocked/LAUNCH-BLOCKED-001-owner-legal-privacy-terms-copy.md`.

Status remains: BLOCKED.

Reason: no repository evidence was found that the owner supplied final legal/privacy/terms/cookie/refund/support copy plus publication instructions and review path. This task authorizes preparation and analysis only.

## 19. Proposed implementation ticket

Created exactly one future implementation ticket:

- `docs/tickets/blocked/LAUNCH-LEGAL-002-publish-owner-approved-legal-copy.md`

Status: BLOCKED.

Blocked on completed owner questionnaire, final copy, provider inventory approval, legal review decision, and publication locations.

## 20. Files changed

- `docs/tickets/ready/LAUNCH-LEGAL-001-legal-privacy-terms-readiness-pack.md`
- `docs/tickets/blocked/LAUNCH-LEGAL-002-publish-owner-approved-legal-copy.md`
- `docs/operations/legal-owner-decision-questionnaire.md`
- `docs/operations/legal-privacy-terms-publication-checklist.md`
- `docs/reports/reconciliation/LAUNCH-LEGAL-001-LEGAL-PRIVACY-TERMS-READINESS-PACK.md`

No runtime, global docs, build-critical, package, schema, migration, script, roadmap, strategy, or spec files were modified.

## 21. What did not change

- Application legal pages were not edited.
- Footer/navbar/checkout/support/signup/comment UI was not edited.
- Payment, patron, subscription, comments, playback, email, auth, logging, env, schema, package, build, and tests were not edited.
- Existing `LAUNCH-BLOCKED-001` was not unblocked and remains BLOCKED.
- No final legal copy was published or approved.

## 22. Risks

- The repository has no `origin` remote in this environment, so “latest main” could only mean the current local baseline SHA.
- Some provider/legal facts cannot be established from code: physical hosting locations, transfer mechanisms, DPA/contract status, controller identity, retention periods, and exact support/legal contact.
- Current public legal pages are stale relative to runtime and owner decisions; leaving them unchanged keeps the legal/public-policy blocker open.
- Cookie/analytics legal conclusions require owner/legal review; this report only records implementation truth and gaps.
- Newsletter unsubscribe route may be incomplete or route-dependent; no runtime test was run because validation was restricted.

## 23. Remaining blockers

- OWNER_DECISION_REQUIRED: identity, contact, controller, refund process, partial refund policy, access exceptions, community rules, retention, provider approval, cookie/analytics intent, publication locations, effective date/version.
- LEGAL_REVIEW_REQUIRED: consumer/payment/refund wording, privacy lawful bases/rights/retention/transfers/providers, cookie consent, community sanctions, jurisdiction/change notices.
- BLOCKED: final legal publication through `LAUNCH-BLOCKED-001` and `LAUNCH-LEGAL-002`.

## 24. Recommended next action

Owner should complete `docs/operations/legal-owner-decision-questionnaire.md`, decide the legal review path, approve/adjust the provider inventory, and then authorize a separate implementation ticket only after final copy and publication locations are ready.

## 25. Verdict

MERGE for this docs-only readiness pack.

Final legal publication remains BLOCKED.
