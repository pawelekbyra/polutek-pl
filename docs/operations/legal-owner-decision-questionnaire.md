# Legal owner decision questionnaire

Status: OWNER_DECISION_REQUIRED / LEGAL_REVIEW_REQUIRED.

Purpose: collect directly answerable owner inputs needed before final legal/privacy/terms/cookie/refund/support/community copy can be prepared or published. This is not legal advice. No default answer is assumed.

For each item, fill **Owner answer** and **Legal review** before publication.

## Identity

| Question | Why needed | Current known fact | Default not assumed | Owner answer | Legal review |
| --- | --- | --- | --- | --- | --- |
| What legal name or individual identity may be published as operator/controller? | Terms/privacy need an accountable public identity. | Current privacy page lists only `pawel.perfect@gmail.com`; no legal name/entity/address evidence found in inspected code. | No controller identity is inferred from email or repo ownership. |  |  |
| Is there a business/trading name to publish? | Public-facing documents may need the service/operator name distinction. | `APP_NAME` defaults to `polutek.pl`; product identity says Polutek.pl is one creator's VOD/community place. | No registered business/trading status is assumed. |  |  |
| What address or legally acceptable contact address should be published? | User rights, complaints, consumer/support contacts may require a reachable address. | No address evidence found in current legal pages or inspected config. | No physical or substitute address is invented. |  |  |
| What email/contact form is the official legal/support/data-request contact? | Needed for privacy rights, support/refunds, security incidents, and copyright/community reports. | Privacy page currently shows `pawel.perfect@gmail.com`; no dedicated support route/page found. | The current email is not assumed to be final. |  |  |
| Are tax/business registration details applicable and publishable? | Payment/support wording may need business/tax identity details. | No registration/VAT/tax status evidence found. | No VAT/tax/business status is assumed. |  |  |
| Who is the data controller identity for privacy copy? | Privacy copy cannot be completed without controller identity. | Not evidenced beyond service/contact email. | No controller identity is inferred. |  |  |

## Product/payment

| Question | Why needed | Current known fact | Default not assumed | Owner answer | Legal review |
| --- | --- | --- | --- | --- | --- |
| Preferred public description: donation, tip, support, digital-content purchase, or mixed model? | Terms, checkout, refund and consumer-rights wording depend on the public model. | Owner decisions say patronat is a reward for qualifying one-time support/donation; current UI uses one-time tip/support wording. | No legal characterization is chosen by the agent. |  |  |
| Should patron access be explicitly framed as a reward/benefit for qualifying one-time support? | Copy must avoid recurring subscription language and explain the benefit. | Owner decisions say yes as product policy. | Exact binding wording is not assumed. |  |  |
| What is the refund-support process? | Users need a clear route and process for support/refund requests. | Runtime handles Stripe refunds/disputes, but no complete public refund/support process was found. | No response process is invented. |  |  |
| What response timeframe should be promised, if any? | Public support promises need operational commitment. | No timeframe evidence found. | No SLA is assumed. |  |  |
| What is the partial refund policy for access? | Owner OQ-001 is open and affects PatronGrant handling. | Runtime marks partial refunds and recalculates status; owner decision remains unresolved. | No partial-refund access outcome is assumed. |  |  |
| How should chargeback/dispute communication be described? | Current runtime can suspend/reactivate/revoke linked access on dispute lifecycle. | Owner decisions define opened/won/lost access consequences; user communication copy is missing. | No notice/timeline wording is assumed. |  |  |
| Which currencies/countries are supported for launch? | Payment copy must match available currencies and any geographic restrictions. | Code supports PLN, EUR, USD, CHF, GBP with 10-unit default minimums. | No country availability or restriction is assumed. |  |  |
| Is there an age requirement? | Signup/payment/community rules may need age wording. | No age requirement evidence found. | No age limit is invented. |  |  |

## Access

| Question | Why needed | Current known fact | Default not assumed | Owner answer | Legal review |
| --- | --- | --- | --- | --- | --- |
| What exact lifetime/no-expiry wording should be used? | Current terms overstate permanence unless exceptions are included. | Owner decisions say lifetime/no-expiry by default unless suspended/revoked by policy. | No unconditional lifetime promise is assumed. |  |  |
| What suspension/revocation grounds should be listed? | Access can be affected by refunds, disputes, abuse, fraud, manual policy decisions, security/legal obligations. | Runtime supports linked full refund revoke and dispute opened/won/lost lifecycle; admin grant/revoke exists. | No comprehensive sanctions list is invented. |  |  |
| What abuse/fraud policy should apply? | Community/payment abuse rules need owner-approved boundaries. | Current terms only generally require lawful use. | No penalties beyond current behavior are invented. |  |  |
| What happens to patron access after account deletion? | Deletion impacts identity-bound grants and support records. | User deletion exists in code paths/docs, but final access/legal effect is not evidenced. | No deletion effect is assumed. |  |  |
| Is patron access transferable? | Terms need account/access transfer rules. | No transfer policy evidence found. | No transferability rule is assumed. |  |  |
| What happens if the service closes or content is discontinued? | Lifetime-access wording needs service-closure boundaries. | No service-closure policy evidence found. | No continued-service promise is assumed. |  |  |

## Privacy

| Question | Why needed | Current known fact | Default not assumed | Owner answer | Legal review |
| --- | --- | --- | --- | --- | --- |
| What retention periods apply by data category? | Privacy policy cannot safely state retention without owner/legal input. | Retention periods are not evidenced in current public copy. | No retention period is invented. |  |  |
| What is the account deletion process and effect? | Users need a request path and deletion explanation. | Email templates mention account deletion confirmation; no complete public process found. | No deletion SLA/process is assumed. |  |  |
| How long is support correspondence retained? | Support contacts can contain personal data. | Support email/contact route is not finalized. | No retention is assumed. |  |  |
| How are comments retained/deleted? | Community data and moderation state need disclosure. | Comment moderation states exist; final retention/deletion policy is not evidenced. | No comment-retention rule is assumed. |  |  |
| How long are payment records retained? | Payment/tax/fraud records require careful legal treatment. | Payment records are stored in PostgreSQL; retention not evidenced. | No accounting/tax retention is assumed. |  |  |
| What is the newsletter consent model? | Newsletter consent must remain separate from patron access. | `Subscription` purpose is email notifications; unsubscribe does not mutate PatronGrant in inspected use-case. | No marketing consent wording is assumed. |  |  |
| Is the provider list approved for publication? | Privacy copy must name/describe actual recipients/processors accurately. | Evidence includes Clerk, Stripe, Cloudflare Stream, Vercel deployment config, PostgreSQL via Prisma, Resend, Upstash/KV rate-limit env candidates, operational logs. | No legal processor role/DPA status/location is assumed. |  |  |
| Does international transfer language need review? | Provider locations/transfer mechanisms are not evidenced in repo. | No transfer mechanism evidence found. | No SCC/adequacy/DPA claim is assumed. |  |  |
| What contact should receive data requests? | Privacy rights need a reliable route. | Current page lists one email; final role unknown. | Current email not assumed final. |  |  |

## Cookies

| Question | Why needed | Current known fact | Default not assumed | Owner answer | Legal review |
| --- | --- | --- | --- | --- | --- |
| Is analytics currently intended for launch? | Privacy page claims traffic analysis, but no analytics SDK was found in inspected code. | No first-party analytics SDK/pixel found; referral cookie and language localStorage exist; Clerk/Stripe may set their own cookies. | No analytics provider is assumed. |  |  |
| If optional analytics is intended, which provider? | Cookie notice/preferences depend on provider and trigger. | None found in package/runtime search. | No optional analytics provider is invented. |  |  |
| Is a cookie banner/preference center required by owner/legal review? | Current app has no consent banner/preference storage found. | No banner/component found. | No legal conclusion about necessity is made. |  |  |
| What cookie preference mechanism should exist if required? | Implementation needs destination and behavior. | No preference mechanism found. | No implementation is assumed. |  |  |
| Are external embeds intended beyond current video/payment/auth providers? | External embeds can add cookies/storage. | YouTube-nocookie support exists in media source policy; Stripe Elements and Clerk are used. | No additional embeds are assumed. |  |  |

## Content/community

| Question | Why needed | Current known fact | Default not assumed | Owner answer | Legal review |
| --- | --- | --- | --- | --- | --- |
| What comment rules should users accept? | Current terms lack detailed community rules. | Runtime supports comments, reports, hide/delete/restore/dismiss audit in admin paths. | No detailed prohibited-content list is invented. |  |  |
| What moderation rights should be reserved? | Terms/community rules need owner-approved moderation boundaries. | Moderation states and admin actions exist. | No penalty/escalation schedule is assumed. |  |  |
| What prohibited content list applies? | Users need clear boundaries. | Current terms only mention lawful/non-infringing behavior generally. | No list is invented. |  |  |
| What is the report process? | Runtime has report endpoints; public explanation is missing. | Report action requires authenticated/patron-admin access for patron content; guests cannot report. | No response process is assumed. |  |  |
| Is there an appeal/contact path for moderation/access decisions? | Manual sanctions need support path. | No appeal path evidenced. | No appeal path is assumed. |  |  |
| What copyright/takedown contact should be used? | VOD/community site may need takedown contact. | No dedicated copyright contact found. | No copyright process is assumed. |  |  |

## Review/publication

| Question | Why needed | Current known fact | Default not assumed | Owner answer | Legal review |
| --- | --- | --- | --- | --- | --- |
| Is professional counsel review required before publication? | Existing blocker requires owner decision on counsel review. | `LAUNCH-BLOCKED-001` remains blocked on legal/privacy/terms copy and review path. | No counsel review status is assumed. |  |  |
| Is there an approved source/template jurisdiction? | Legal copy source affects jurisdiction, consumer rights, language. | No approved source/template found. | No jurisdiction/template is assumed. |  |  |
| Which languages are required at launch? | App has PL/EN UI elements; current legal pages are Polish-only. | `LanguageContext` supports PL/EN UI strings. | No legal-language requirement is assumed. |  |  |
| What effective date should appear? | Current legal pages have no visible effective date/version. | No effective date found. | No date is invented. |  |  |
| What versioning process should be used? | Future updates need evidence and rollback. | No legal-copy update process found. | No process owner/cadence is assumed. |  |  |
| Where must footer/checkout/signup disclosures appear? | Publication implementation needs exact destinations. | Footer currently lacks legal/privacy/cookie/support links; support box has terms/privacy checkbox/buttons. | No final placement is assumed. |  |  |
