# Payment and tax tooling for a one-creator video site (Wyoming LLC, owner in Poland), lifetime one-time digital access, worldwide B2C and some B2B — as of 12 October 2026

Access date for every URL below: 2026-10-12 (fetched or searched that day). "Primary" = vendor's own page/docs; "secondary" = third-party blog/aggregator (often a competitor, treat with caution). Prices in USD unless stated. Stripe's public pricing page auto-localised to the Poland (zł) page for my fetches, so some Stripe numbers are zł and US-card rates come only from secondary sources — flagged.

---

## 1. Stripe Payments + Stripe Tax (calculation, registration, filing, thresholds, invoicing, VAT IDs, Radar, fees, US account, Atlas) — options (a) and (b)

### Takeaway
Stripe is the cheapest and most controllable route, but the LLC stays the seller of record and liable for VAT/sales tax; Stripe Tax calculates and monitors, and (with a paid Tax Complete plan) can register and file, including non-Union OSS through Ireland. Stripe Billing is not needed for one-time lifetime purchases (Checkout `mode=payment` is enough). Poland and the US are both valid Stripe Tax business locations, so the owner's residency is not a blocker for Stripe Tax itself.

### Cited Findings
**Card fees**
- Stripe Poland page (zł): domestic standard EEA cards 1.5% + 1.00zł; premium EEA 1.9% + 1.00zł; UK cards 2.5% + 1.00zł; international cards 3.25% + 1.00zł plus 2% if currency conversion is needed; Adaptive Pricing conversion fee "starting at 2%"; standard payouts free; instant payouts 1% (min 2zł). — [Stripe pricing (PL page)](https://stripe.com/pricing)
- US-account card rates (2.9% + 30¢ domestic; +1.5% international cards; +1% currency conversion) come from SECONDARY sources only; one source gives +1% for international instead of +1.5%. Stripe's own US page did not load for me. — [flexprice](https://flexprice.io/blog/stripe-pricing-breakdown-2026), [size.ly](https://www.size.ly/tools/stripe-fee-calculator), [toolradar](https://toolradar.com/tools/stripe/pricing), conflicting: [wearefounders](https://www.wearefounders.uk/a-guide-to-stripe-fees-in-2025-what-founders-need-to-know/)
- Disputes (PL page): 90.00zł per received dispute; 90.00zł per countered dispute, refunded if won; Smart Disputes 30% of disputed amount on wins. Secondary sources say $15 in the US. — [Stripe pricing](https://stripe.com/pricing), [flexprice](https://flexprice.io/blog/stripe-pricing-breakdown-2026)
- Refunds: original processing and currency conversion fees are not returned. — [Stripe pricing](https://stripe.com/pricing)
- Radar (PL page): pay-as-you-go from 0.23zł per screened transaction; monthly from 46zł. (Whether basic Radar is bundled free on standard Payments was not stated on the page.) — [Stripe pricing](https://stripe.com/pricing)
- Invoicing: post-payment invoices from Checkout/Payment Links 0.4% of total, capped at US$2 per invoice; Starter 0.4% per paid invoice. — [Stripe pricing](https://stripe.com/pricing)

**Stripe Tax pricing (USD, primary support article)**
- Tax Basic: no-code integrations (Checkout, Payment Links, Invoicing, Billing) 0.5% of processed volume where you are registered to collect tax; API: $0.50 per Transaction API call and $0.05 per Calculation call (10 free calcs per transaction). — [Stripe support: Understanding Stripe Tax pricing](https://support.stripe.com/questions/understanding-stripe-tax-pricing)
- Tax Complete (annual contract), per month: $90 (200 transactions, 2 registrations/yr, 4 filings/yr; extra transactions $0.50 each); $430 (1,000 txn, 4 reg, 12 filings); $1,000 (2,500 txn, 6 reg, 20 filings); $1,500 (5,000 txn, 10 reg, 32 filings). — [Stripe support](https://support.stripe.com/questions/understanding-stripe-tax-pricing)
- Additional non-US registration: $150 (Colombia $1,050); US registrations $0. Registration overage beyond plan: $150 US / $300 other. — [Stripe support](https://support.stripe.com/questions/understanding-stripe-tax-pricing)
- Additional non-US filing fees: EU-based or no fiscal representation needed: quarterly $145, OSS (Union OSS and IOSS) $145; non-EU needing fiscal representation: quarterly $445, OSS $445; US and Canada filings $0. Overage beyond plan: US/Canada $55; EU-based no fiscal rep OSS $200. No separate line for NON-UNION OSS was listed. — [Stripe support](https://support.stripe.com/questions/understanding-stripe-tax-pricing)
- Stripe's own non-Union OSS filing page says: "You must subscribe to Tax Complete. Contact Stripe for availability and pricing for these filings." — [Stripe docs: file taxes outside the US](https://docs.stripe.com/tax/file-with-stripe-outside-us)
- PL-page Tax Complete from 360zł/month (same tier structure: 2 registrations, 200 txn/month, 4 filings/yr); "additional fees may apply for registrations and filings outside the US". — [Stripe Tax pricing (PL)](https://stripe.com/tax/pricing)

**Stripe Tax functionality**
- Business location supported for both US and PL (and all EU states); customer location supported for 100+ jurisdictions; digital-products-only in many non-EU countries. — [Stripe Tax supported countries](https://docs.stripe.com/tax/supported-countries)
- Stripe offers automated filing for EU Non-Union OSS through Ireland (for businesses not established in the EU) and Canada simplified GST/HST; quarterly returns, due last day of the month after quarter end; Stripe does NOT debit your account, you pay the authority using Stripe's payment instructions; you remain legally responsible; covers B2C supplies only (B2B supplies and local VAT returns excluded); Stripe "can register with local tax authorities on your behalf" for EU/Canada remote sellers. — [Stripe docs](https://docs.stripe.com/tax/file-with-stripe-outside-us)
- Filing options: Stripe (US automated, Ireland non-Union OSS, Canada), Taxually (global, credits included in Tax Complete), Marosa (EU, separate pricing), Hands-off Sales Tax (US/Canada, from $55/return). "Register for me" registers but does not prepare returns or remit tax. — [Stripe docs: file and remit](https://docs.stripe.com/tax/filing)
- Threshold monitoring with Dashboard/email alerts, VAT OSS threshold monitoring; automatic validation of VAT IDs and ABNs; 100+ countries. — [Stripe Tax overview](https://stripe.com/tax)
- Marosa publishes three monthly plans labelled 1000 / 1200 / 1500 (currency and billing period not stated on the page; 6/10/15 VAT registrations, up to 12/25/50 filings) — [Marosa](https://stripe.marosavat.com/home)
- US registration fee examples charged by states themselves (e.g. CT $100, HI $20) and a US bank account needed for some. — [search summary of Stripe docs](https://docs.stripe.com/tax/use-stripe-to-register)

**B2B / VAT IDs**
- Checkout `tax_id_collection[enabled]=true` shows tax-ID fields by customer location; collects business tax IDs only; Stripe verifies format and asynchronously validates EU VAT, UK VAT and ABN against government databases (status pending/verified/unverified/unavailable; the result event only fires if saved to a Customer; guests get no verification result). Stripe Tax applies reverse charge/zero rate when the ID has the right format "regardless of the government verification result" — so you are responsible for handling `unverified` IDs. — [Stripe docs: Checkout tax IDs](https://docs.stripe.com/tax/checkout/tax-ids)

**EU 14-day withdrawal / digital-content waiver**
- Stripe Checkout offers `consent_collection.terms_of_service='required'` and `custom_text.terms_of_service_acceptance`; acceptance is recorded as `consent.terms_of_service`. I found no first-class Stripe setting for a dedicated "waive withdrawal right" consent; custom text may not conflict with Stripe-generated text. — [Stripe docs: Checkout policies](https://edge-docs.stripe.com/payments/checkout/customization/policies)
- Waiver requires prior express consent to immediate supply AND acknowledgement of losing withdrawal right (plus confirmation on a durable medium); a 2019 Cologne court took a strict view that the waiver must not be merged with the contract-formation statement (appeal/conflict noted). — [Osborne Clarke](https://osborneclarke.com/insights/withdrawal-right)

**Stripe account for a US LLC / Atlas**
- Atlas: $500 one-time (incl. registered agent year 1), $100/yr renewal after; refunded if you fund a Stripe Treasury account with $5,000 in 90 days; page describes Delaware C-corp/LLC; Wyoming not mentioned; eligibility for non-US founders not stated on the page. — [Stripe Atlas](https://stripe.com/atlas)
- Managed Payments requires the Stripe account's business location to be in the supported list, which includes US and PL — [Stripe docs eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)

**Stripe Billing**
- Billing PL page: pay-as-you-go 0.7% of Billing volume; monthly plan from 2,500zł. Managed Payments docs list subscriptions as "available with Billing"; one-time payments use Checkout `mode=payment` with no Billing. — [Stripe pricing](https://stripe.com/pricing), [Managed Payments set-up](https://docs.stripe.com/payments/managed-payments/set-up)

**Accounting**
- Stripe says QuickBooks Online and Xero integrations come via Stripe Apps ("QuickBooks Sync by Acodei", "Xero sync by Xero"); third-party Synder, SubSync etc. also exist. — [Stripe docs: accounting integrations](https://edge-docs.stripe.com/stripe-apps/embedded-apps/accounting-integrations)

### Inferences
- Stripe Billing: not needed for lifetime one-time access; Checkout (`payment` mode) + `checkout.session.completed` webhook is enough. Billing would only matter if a subscription tier is added later.
- A US LLC owned by a Poland resident is a "non-EU business" for EU VAT purposes: B2C digital sales to EU consumers go through non-Union OSS (Ireland, quarterly, EUR, no threshold for non-EU sellers). Stripe automates this filing only on Tax Complete (≥ $90/mo, annual contract) plus an unpublished non-Union OSS fee; self-filing the Irish OSS portal with Stripe Tax reports is the zero-subscription alternative.
- US sales tax exposure at ≤1,000 sales/year is likely below most state economic-nexus thresholds, but digital video taxability differs by state; threshold monitoring (included in both Stripe Tax plans) is the control.
- Whether the Poland resident's effective-management/permanent-establishment status triggers Polish VAT/CIT on the LLC is a legal question outside these sources.
- The repo's CLAUDE.md states the site already uses Stripe Checkout/Elements with `fulfillPayment()` webhook fulfilment for voluntary tips (§4.2, §4.10), so Stripe is the lowest-integration-effort route; a paid-access product would need an explicit owner decision because §1/§4.14 currently forbid access fees.

### Gaps
- Stripe's own US pricing page (2.9% + 30¢, international surcharge, conversion, dispute fee in USD) did not load; numbers are secondary.
- Price of Stripe's non-Union OSS filing ("contact Stripe"); Taxually's own per-registration/filing price (one secondary blog implied ~$500 per international registration, unverified); Marosa currency/period.
- Whether standard Radar is included free for Checkout; whether Tax Complete "included filings" can be used for the Irish OSS return.
- Whether Atlas accepts non-US founders and offers Wyoming (page silent); Stripe payout requirements for non-US owner of a US LLC (US bank accounts such as Mercury; Wise USD account details) — not verified from primary docs.

---

## 2. Has Stripe launched its own Merchant of Record? Stripe Managed Payments and Lemon Squeezy status — option (c) and (e)

### Takeaway
Yes. Stripe Managed Payments (MoR on top of Checkout/Payment Links) is live as of 2026, priced at +3.5% per successful transaction on top of normal Payments fees, with Stripe (shown to buyers as "Link"/"Sold through Link, LLC") as merchant of record in 80+ tax countries; a US or Polish Stripe account qualifies. Lemon Squeezy continues as a separate product, but its team is building Managed Payments and promises a migration path; no sunset date has been published.

### Cited Findings
- Stripe describes Managed Payments as "the Stripe merchant of record solution" handling sales tax/VAT/GST in 80+ countries, fraud, disputes, transaction-level support; works with Checkout and Payment Links only; Elements, hosted invoice page, Connect, creating subscriptions outside Checkout/Payment Links and third-party tax integrations are unsupported. — [Stripe docs: Managed Payments](https://docs.stripe.com/payments/managed-payments)
- Pricing: "3.5% per successful transaction, in addition to Payments fees"; no setup/monthly minimums (Poland page). — [Stripe pricing](https://stripe.com/pricing), [Stripe Managed Payments](https://stripe.com/managed-payments)
- Eligibility: Stripe "eligibility review"; business locations include US, CA, GB, PL and most EU states, CH, NO, AU, HK, JP, SG; product categories include software, video games, digital media (audio/video content) and online courses; excludes physical goods, professional services, live in-person events; requires fully automated digital products sold directly; buyers from 195+ countries except Ascension, China, Cuba, Iran, Kosovo, North Korea, Russia, Syria, Tristan da Cunha. — [Stripe docs: eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)
- Each product needs an eligible tax code; video-related codes listed are streamed (limited rights), downloaded (permanent rights), and bundles (downloaded permanent + streamed); on-demand online course codes (streamed; streamed + downloadable) also eligible. — [Stripe docs: eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)
- Activation: accept Managed Payments ToS in Dashboard; API version 2025-03-31.basil or later; set `managed_payments[enabled]=true` on Checkout Session; one-time `mode=payment` is explicitly supported; events `checkout.session.completed` / async_payment_succeeded / failed. — [Stripe docs: set up](https://docs.stripe.com/payments/managed-payments/set-up)
- Buyer experience: receipts/invoices sent from Link (not your branding); statement descriptor `LINK.COM* [your descriptor]`; custom domains not supported on MP checkout; customers manage orders on link.com; Adaptive Pricing on by default. — [Stripe docs: how it works](https://docs.stripe.com/payments/managed-payments/how-it-works)
- Disputes: Stripe handles them (submits evidence on your behalf); a "dispute received" fee still applies to you; Stripe covers the evidence fee when it counters. Refunds: customers can ask Link support; Stripe can refund within 60 days in certain cases; if you don't respond within 48 hours on product questions Stripe may refund without approval; sales tax in some jurisdictions is retained on refunds and deducted from your balance. — [Stripe docs: how it works](https://docs.stripe.com/payments/managed-payments/how-it-works)
- Ongoing eligibility needs a low historical dispute rate and no prior risk issues; Stripe applies regional cooling-off rules. — [Stripe docs: eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)
- Tax coverage: domestic and cross-border in all EU states, UK, CH, NO, US, CA, AU, NZ, JP, KR, SG, IN, ID, MX, ZA, TR, SA etc.; Stripe registers, files, remits and issues tax invoices; uncovered countries remain the seller's job (Stripe Tax calculation free on those MP transactions); for those, invoices use your name and tax details. — [Stripe docs: tax compliance](https://docs.stripe.com/payments/managed-payments/tax-compliance)
- Reports expose `withheld_tax` and `fee_net_of_withheld_tax`; payment processing is by Stripe acquiring affiliates (Stripe Payments Company, Stripe Technology Europe, etc.). — [Stripe docs: how it works](https://docs.stripe.com/payments/managed-payments/how-it-works)
- Lemon Squeezy: 28 Jan 2026 post by JR Farr: the Lemon Squeezy team is building Stripe Managed Payments, goal of an "easy way to migrate", public sign-up "very soon", 35+ merchant countries then, more later in the year; no shutdown date, no pricing change stated; acknowledged slower support and product updates; unsupported-country merchants pointed to Stripe Atlas. — [Lemon Squeezy blog](https://www.lemonsqueezy.com/blog/2026-update)
- Lemon Squeezy pricing page still shows 5% + 50¢ and a banner "2026 Update: Lemon Squeezy + Stripe Managed Payments"; payouts by bank wire or PayPal twice monthly in 200+ countries. — [Lemon Squeezy pricing](https://www.lemonsqueezy.com/pricing)
- Lemon Squeezy fees doc: +1.5% international, +1.5% PayPal, +0.5% subscriptions; payouts via Stripe free for US bank accounts and 1% per payout outside the US; PayPal payouts $0.50 (US) or 3% capped at $30 (non-US). — [Lemon Squeezy fees](https://docs.lemonsqueezy.com/help/getting-started/fees)
- Third-party commentary dates Stripe's announcement at Sessions 2025 (private preview), public preview 2026; some blogs wrongly say MP costs 5% + 50¢. — [checkoutpage.com](https://checkoutpage.com/blog/stripe-managed-payments), [fungies](https://fungies.io/lemon-squeezy-stripe-acquisition-saas-founders-2026/) (secondary; contradicted by Stripe's own 3.5% page)

### Inferences
- Managed Payments is the Stripe-native way to get MoR with the same Checkout code and webhooks; effective all-in is Payments fees + 3.5%, i.e. roughly 6.4% + 30¢ for a US domestic card and ~7.9% + 30¢ for an international card using the secondary-source US rates — more expensive than Paddle's 5% + $0.50 on $90 sales and similar on $30 sales, but with Stripe's tooling and no separate vendor.
- Lemon Squeezy is in a "maintenance + migration-to-Stripe" posture; starting a new integration there in late 2026 looks like a detour versus going straight to Managed Payments.
- Poland residency does not block Managed Payments because eligibility keys off the Stripe account's business location (US LLC → US; PL also supported).
- Lifetime streaming access has no obviously matching "streamed + permanent rights" tax code in the published list; choosing the closest (e.g. bundle or on-demand course) should be confirmed with Stripe Tax/support.

### Gaps
- Stripe's exact US-page wording for Managed Payments price (only the PL page was retrieved) and whether 3.5% applies to tax-inclusive gross; payout schedule/holds specific to MP.
- Specific Lemon Squeezy migration mechanics and sunset timing (none published); Lemon Squeezy's current acceptance policy for video/courses.
- Whether Managed Payments applies a reserve or extra KYC for new LLCs (not documented in pages fetched).

---

## 3. Paddle (Billing / Classic) — option (d)

### Takeaway
Paddle is a mature MoR at 5% + 50¢ all-in (tax, chargebacks, fraud, buyer support), but is explicitly oriented to software/SaaS; pre-recorded digital courses/video are eligible in principle but are subject to a manual domain review and category scrutiny. Payouts are monthly with a $100 default threshold.

### Cited Findings
- Pay-as-you-go: 5% + 50¢ per Checkout transaction; no monthly fees; includes global tax compliance, fraud protection, chargebacks and buyer support; under-$10 products may request bespoke pricing; no lock-in. — [Paddle pricing](https://www.paddle.com/pricing)
- Payouts monthly (balance converted on the 1st, sent by the 15th, up to 3 working days); methods wire transfer or Payoneer; minimum $100 (adjustable to $100,000; £100/€100); balances in GBP/EUR/USD. — [Paddle help: when and how do I get paid](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid)
- Payout fees: no Paddle fee beyond its own; ACH (US, USD) no fees; SEPA no fees; SWIFT wire fee of $/€/£15; Payoneer fees on you; currency conversion margin up to 1.5% if payout currency differs from balance currency. — [Paddle help: payout fees](https://www.paddle.com/help/manage/get-paid/is-there-a-fee-taken-for-payouts)
- Supported buyer countries: 200+ with automatic currency/tax preference; transactions from sanctioned/unsupported countries blocked. — [Paddle developer docs](https://developer.paddle.com/concepts/sell/supported-countries-locales)
- Acceptable use: prohibits physical goods, human services unrelated to software (coaching/consulting), "community access" without bona fide software/service, adult/age-restricted content, illicit streaming/downloaders, certifications/courses where the seller is not the owner/creator, deepfakes, digital marketplaces; online courses/video not prohibited per se. — [Paddle AUP](https://paddle.com/support/aup)
- Onboarding: domain review (live HTTPS site, product description, pricing, terms/refund/privacy policy naming Paddle as MoR), business verification (registration documents, >25% owners), identity verification; business checks usually 2–4 business days when manual; payout account needed only before payout. — [Paddle help: domain approval](https://www.paddle.com/help/start/account-verification/what-is-domain-approval), [business verification](https://www.paddle.com/help/start/account-verification/what-is-business-verification)
- Paddle's terms (as quoted by sellers): 14-day statutory withdrawal right for EU/EEA/CH/UK consumers on digital content unless consent to immediate supply and acknowledgement obtained at checkout (Paddle manages this consent); otherwise purchases are non-refundable; refunds end access. — [seller policy pages summarised in search](https://learn.profitwell.com/legal/refund-policy) (secondary; Paddle Buyer Terms not retrieved)

### Inferences
- Paddle appears to be seller on the buyer's invoice (MoR), shielding the LLC from VAT registration, chargebacks and invoicing; B2B VAT-ID handling is done by Paddle (standard for MoR; not independently verified here).
- Lifetime one-time access fits Paddle Billing one-time items; entitlement grant/revoke is done via webhooks (`transaction.completed`, refunds/adjustments) — not verified in this research.
- A video-content site is acceptable but not Paddle's core segment; expect manual review and possible questions; adult content is a hard no.

### Gaps
- Paddle seller (business) country list and any explicit US-LLC-with-non-US-owner restriction; Paddle Classic vs Billing status in 2026 (not verified; Billing is the current product per docs); dispute/chargeback fee schedule; Paddle's current Buyer Terms text; webhook/API/Next.js integration quality (not examined).

---

## 4. Other MoR platforms: FastSpring, Polar.sh, Creem, Gumroad, Xsolla, Digital River — options (f)–(k)

### Takeaway
Polar and Creem are the low-fee newcomers (Polar 5% + 50¢ Starter, tiered down to 3.4% + 30¢; Creem 3.9% + 40¢) but have small track records and payout/KYC caveats; FastSpring is quote-based (~5.9% + 95¢ per secondary sources); Gumroad is the most expensive; Xsolla is game-focused and opaque; Digital River is defunct.

### Cited Findings
**Polar.sh**
- Plans: Starter free 5% + 50¢; Pro $20/mo 3.8% + 40¢; Growth $100/mo 3.6% + 35¢; Scale $400/mo 3.4% + 30¢; early members (orgs created before 27 May 2026) 4% + 40¢. Extras: +1.5% international cards; $15 per dispute regardless of outcome; payouts via Stripe: $2/month active + 0.25% + $0.25 per payout; cross-border 0.25% EU / 1% elsewhere; refunds don't return fees. Polar is MoR. — [Polar fees](https://polar.sh/docs/merchant-of-record/fees)
- Payouts via Stripe Connect Express to 100+ countries (US and Poland-capable list presumably; page lists US among examples); customers from Cuba, Russia, Iran, North Korea, Syria blocked. — [Polar supported countries](https://polar.sh/docs/merchant-of-record/supported-countries)
- Prohibited: adult content, community access/donations/crowdfunding/sponsorship, services for minors, gambling/loot boxes, physical goods and human services, third-party content downloaders; restricted: eBooks, pre-orders, tickets, AI generation; courses and "File Downloads" acceptable; video not prohibited. — [Polar acceptable use](https://polar.sh/docs/merchant-of-record/acceptable-use)

**Creem**
- 3.9% + $0.40 per transaction, $0 monthly/setup; handles VAT/GST/sales tax in 50+ countries, invoices, refunds and chargebacks; payouts 1st and 15th by bank or USDC. — [Creem pricing](https://creem.io/pricing)
- Seller payout countries: 86 listed incl. United States and Poland; bank transfer fee 7 EUR/USD or 1% of payout, whichever is higher; buyers from all but 32 countries (incl. Russia, Iran, Cuba, Venezuela, Zimbabwe). — [Creem docs: supported countries](https://docs.creem.io/merchant-of-record/supported-countries)

**FastSpring**
- No published rates; quote-based commission; no minimum volume; MoR for SaaS/software/digital goods anywhere; quote form lists Online Course/Membership as product type. — [FastSpring pricing](https://fastspring.com/pricing/)
- Secondary benchmark ~5.9% + $0.95, up to ~8.9% for low-volume/high-risk, FX markups 1–3%. — [toolradar](https://toolradar.com/tools/fastspring/pricing), [dodopayments](https://dodopayments.com/blogs/fastspring-pricing-explained/) (competitor)

**Gumroad**
- Direct sales 10% + $0.50; Discover marketplace 30%; MoR for all tax since 1 Jan 2025. Whether card processing is on top for direct sales is disputed: secondary sources say yes (≈2.9% + 30¢ US, 3.9% intl), Gumroad's page excerpt is silent. Payouts by bank or PayPal only (no Wise/Payoneer); refunds don't return fees. — [Gumroad pricing](https://gumroad.com/pricing), [Gumroad help via search summary](https://gumroad.com/help/article/13-getting-paid), [dodopayments](https://dodopayments.com/blogs/gumroad-fees-explained)

**Xsolla**
- Headline 5% "+ cost of channel" (undefined publicly); quote-based; games-oriented. — [fungies (competitor)](https://fungies.io/alternatives/xsolla), [dodopayments (competitor)](https://dodopayments.com/blogs/xsolla-alternatives/)

**Digital River**
- Insolvency filed for German subsidiaries 28 Jan 2025; offices closed, services suspended, merchants reported lost access to funds; not an option. — [Freemius](https://freemius.com/blog/digital-river-mycommerce-shutdown-guide/), [TCB Magazine](https://tcbmag.com/?p=88002)

### Inferences
- Creem and Polar are the cheapest MoRs on paper, but both are young; Polar's payout path runs through Stripe Connect Express and charges per-payout fees; Creem's bank payouts carry a $7 floor per payout and the FX path to a US LLC account is not documented.
- Gumroad is a storefront with delivery, not a fit for gating a self-hosted video site; its payout options exclude Wise.
- For a custom Next.js entitlement system, Polar (webhooks, "benefits") and Paddle/Stripe (webhooks) are API-first; Gumroad and FastSpring are less so (not verified here).

### Gaps
- Polar benefit/webhook API docs (404 on the page I tried), Creem webhook/API quality, KYC requirements for a US LLC with non-US owner at Polar/Creem, Creem acceptable-use rules for video/courses, FastSpring seller-country list and payout fees, Xsolla official pricing page, Gumroad payout-country table and official processing-fee statement.

---

## 5. Non-MoR PSPs and billing tools: Chargebee/Recurly, Adyen, Mollie, PayPal — option (l)

### Takeaway
None of these makes the LLC non-liable for VAT/sales tax; they are processors or billing layers. Mollie and Adyen are EU/enterprise PSPs and add little for a US LLC with a single product; PayPal is a useful extra payment method only.

### Cited Findings
- Mollie (own pricing as quoted by search): EEA consumer cards 1.80% + €0.25; EEA commercial 2.90% + €0.25; non-EEA cards 3.25% + €0.25. — [Mollie pricing](https://mollie.com/pricing) (via search summary)
- PayPal (secondary, 2026): ~2.99% + $0.49 standard, 3.49% + $0.49 checkout, +1.5% cross-border, currency conversion ~3–4%. — [checkoutpage.com](https://checkoutpage.com/blog/paypal-fees), [ecomcalctools](https://ecomcalctools.com/blog/fees-paypal/paypal-fees-2026/)
- Adyen: minimum monthly invoice reported between ~€100 and ~€1,000 depending on source; interchange++ with ~0.60% markup + ~€0.11. — [costbench](https://www.costbench.com/software/payment-processing/adyen/), [eightx](https://eightx.co/blog/compare/how-much-does-adyen-cost) (conflicting)
- Chargebee/Recurly: not examined directly; they are subscription billing layers on top of a PSP (no MoR) — general knowledge, not sourced here.

### Inferences
- Adding any of these alongside Stripe would multiply tax-compliance surfaces (still your VAT liability) without lowering cost for a US-account seller; Mollie could only make sense if an EU entity existed.

### Gaps
- Mollie/Adyen acceptance of a US LLC with non-US owner and of video-content merchants; Chargebee/Recurly pricing; PayPal's primary fee page.

---

## 6. Cross-cutting: seller of record, B2B VAT IDs, withdrawal right, payouts to a US LLC, KYC, revocation, content restrictions

### Takeaway
With non-MoR Stripe the LLC is the seller on invoices and files VAT/sales tax itself; with MoR (Stripe Managed Payments, Paddle, Polar, Creem, Lemon Squeezy, Gumroad) the platform is the seller shown to the buyer and files taxes, but the LLC still keeps entitlement logic, refunds policy interplay and its own income-tax duties.

### Cited Findings
- Stripe Managed Payments: buyer sees Link as merchant of record ("Sold through Link"); statement descriptor LINK.COM*; invoices/receipts from Link; tax invoices issued by Stripe where required. — [Stripe docs: how it works](https://docs.stripe.com/payments/managed-payments/how-it-works), [tax compliance](https://docs.stripe.com/payments/managed-payments/tax-compliance)
- Paddle: pricing page states Paddle handles tax collection, filings and remittance, chargebacks and buyer support. — [Paddle pricing](https://www.paddle.com/pricing)
- Polar/Creem/Lemon Squeezy/Gumroad: MoR statements as in sections 2 and 4.
- Non-Union OSS (Ireland) covers B2C only; B2B supplies to EU VAT-registered customers are outside it and handled by reverse charge using the customer's VAT ID. — [Stripe docs: file taxes outside the US](https://docs.stripe.com/tax/file-with-stripe-outside-us), [Stripe docs: Checkout tax IDs](https://docs.stripe.com/tax/checkout/tax-ids)
- Stripe Managed Payments: payouts follow the Stripe account (standard payouts free per PL page); Paddle pays monthly with ACH to US accounts free and a $100 threshold; Creem 1st/15th with $7/1% fee; Polar via Stripe Connect Express with per-payout fees; Lemon Squeezy free to US bank accounts via Stripe, 1% outside US. — [Stripe pricing](https://stripe.com/pricing), [Paddle payout fees](https://www.paddle.com/help/manage/get-paid/is-there-a-fee-taken-for-payouts), [Creem docs](https://docs.creem.io/merchant-of-record/supported-countries), [Polar fees](https://polar.sh/docs/merchant-of-record/fees), [Lemon Squeezy fees](https://docs.lemonsqueezy.com/help/getting-started/fees)

### Inferences
- Lifetime-entitlement grant/revoke: every option above can drive it from payment webhooks (Stripe `checkout.session.completed`, refund/dispute events); revocation on refund/dispute must be implemented by the seller's app in all cases.
- EU withdrawal waiver must be captured explicitly in your own checkout flow for non-MoR Stripe; with Managed Payments/Paddle the platform's checkout manages consent per their terms but you should still show your own terms; both approaches need legal review.
- Mercury/Wise/Relay as payout destination: Stripe payouts to US bank accounts (Mercury, Relay) work in principle; Wise USD "account details" is commonly used but was not verified from primary sources.

### Gaps
- Primary-source confirmation of Wise/Mercury/Relay compatibility for Stripe/Paddle/Polar/Creem payouts; KYC specifics (beneficial-owner docs for non-US owner) per vendor; refund-window/discretionary-refund policies of Stripe MP vs Paddle in full.

---

## 7. Cost model (illustrative; 40% US / 40% EU / 20% other; USD list price, tax added on top; fees computed on list price)

### Takeaway
At 100–1,000 sales/year DIY Stripe + Tax Basic with self-filed non-Union OSS is cheapest in fees (~4.3–5.0% of gross) but costs your time; paid managed filing (Tax Complete) adds ~$1,080–1,660/yr, making Paddle cheaper below roughly 1,900 sales/year at $30 (≈850 at $90). At ~5,000 sales, Stripe + Tax Complete (~4.4–5.9%) beats Paddle (5.6–6.7%) and Managed Payments (7.6–8.3%) by a clear margin.

### Cited Findings (assumptions are mine; rates cited above)
Assumed blended Stripe card cost with US account, USD-only prices: 40% US cards at 2.9% + 30¢ and 60% non-US cards at 4.4% + 30¢ (secondary-source rates) = 3.80% + $0.30. Tax Basic: 0.5% of EU volume (only where registered; US states assumed unregistered). Tax Complete low: $1,080/yr; high: +4 × $145 est. for non-Union OSS filings (the actual non-Union OSS price is unpublished). Payments to MoRs: PayPal/Lemon Squeezy PayPal surcharges ignored; Polar Pro uses 3.8% + 40¢ + 1.5% int'l + $240/yr; Polar/Creem payout fees included; FastSpring is a secondary-source estimate; Gumroad shown with and without processing.

Annual total fees (and % of gross):

| Option | 100 × $30 ($3,000) | 1,000 × $30 ($30,000) | 5,000 × $30 ($150,000) | 100 × $90 ($9,000) | 1,000 × $90 ($90,000) | 5,000 × $90 ($450,000) |
|---|---|---|---|---|---|---|
| A1 Stripe + Tax Basic, self-file OSS | $150 (5.0%) | $1,500 (5.0%) | $7,500 (5.0%) | $390 (4.3%) | $3,900 (4.3%) | $19,500 (4.3%) |
| A2 Stripe + Tax Complete $90/mo (low) | $1,224 (40.8%) | $2,520 (8.4%) | $8,280 (5.5%) | $1,452 (16.1%) | $4,800 (5.3%) | $19,680 (4.4%) |
| A2 high (+ est. 4 × $145 filings) | $1,804 | $3,100 (10.3%) | $8,860 (5.9%) | $2,032 | $5,380 (6.0%) | $20,260 (4.5%) |
| B Stripe Managed Payments (+3.5%) | $249 (8.3%) | $2,490 (8.3%) | $12,450 (8.3%) | $687 (7.6%) | $6,870 (7.6%) | $34,350 (7.6%) |
| C Paddle 5% + $0.50 | $200 (6.7%) | $2,000 (6.7%) | $10,000 (6.7%) | $500 (5.6%) | $5,000 (5.6%) | $25,000 (5.6%) |
| D Lemon Squeezy (+1.5% int'l on 60%) | $227 (7.6%) | $2,270 (7.6%) | $11,350 (7.6%) | $581 (6.5%) | $5,810 (6.5%) | $29,050 (6.5%) |
| E Polar Starter (+1.5% int'l, payout fees) | $262 (8.7%) | $2,372 (7.9%) | $11,752 (7.8%) | $630 (7.0%) | $6,062 (6.7%) | $30,202 (6.7%) |
| E Polar Pro | $456 (15.2%) | $2,152 (7.2%) | $9,692 (6.5%) | $752 (8.4%) | $5,122 (5.7%) | $24,542 (5.5%) |
| F Creem 3.9% + 40¢ + payout fee | $325 (10.8%) | $1,870 (6.2%) | $9,350 (6.2%) | $559 (6.2%) | $4,810 (5.3%) | $24,050 (5.3%) |
| G Gumroad 10% + 50¢ (no processing) | $350 (11.7%) | $3,500 (11.7%) | $17,500 (11.7%) | $950 (10.6%) | $9,500 (10.6%) | $47,500 (10.6%) |
| G Gumroad incl. ~processing | $494 (16.5%) | $4,940 (16.5%) | $24,700 (16.5%) | $1,322 (14.7%) | $13,220 (14.7%) | $66,100 (14.7%) |
| H FastSpring ~5.9% + $0.95 (est.) | $272 (9.1%) | $2,720 (9.1%) | $13,600 (9.1%) | $626 (7.0%) | $6,260 (7.0%) | $31,300 (7.0%) |

Not included in A1/A2: your own time or an accountant for the Irish OSS return, US state registrations if thresholds are crossed (Tax Complete includes 2 US registrations/yr at $0), chargeback fees ($15–$24 each, Stripe non-MoR), and any Polish/US income tax. Not included for MoRs: FX margins on payout (Paddle up to 1.5%, Polar 0.25–1%), dispute fees (Polar $15; Stripe MP dispute-received fee).

### Inferences
- MoR premium vs DIY Stripe (A1) is ≈1.2–1.7 percentage points of gross for Paddle and ≈3.3 points for Stripe Managed Payments — that is the price of not registering for non-Union OSS, not filing quarterly, and not handling VAT-ID/chargeback paperwork.
- Break-even of paid managed filing (A2 low: $1,080/yr + ~3.8% + $0.30 per sale) against Paddle (5% + $0.50 per sale): per-sale gap is $0.56 at $30 and $1.28 at $90, so break-even is ≈1,900 sales/yr at $30 and ≈850 sales/yr at $90 (the +$580 high filing estimate pushes these to ≈2,900 and ≈1,300).
- Small-volume (≤100 sales/year) revenue of $3,000–$9,000 makes any $1,080/yr subscription disproportionate; DIY or MoR is better there.

### Gaps
- All Stripe US-rate figures are secondary; Stripe non-Union OSS filing fee unknown; whether MoR fees are charged on tax-inclusive totals; VAT absorption if prices are advertised tax-inclusive (reduces net proceeds in every option).

---

## 8. Ranked recommendation (cheapest/simplest vs most control)

### Takeaway
(1) Simplest all-in: Stripe Managed Payments if the existing Stripe account/Checkout flow is kept (one extra API parameter), or Paddle if the lowest MoR cost at ≥$90 prices matters more than staying on Stripe. (2) Cheapest at scale and most control: Stripe Checkout + Stripe Tax with non-Union OSS registration (Irish OSS) and Tax Complete or self-filing. (3) Cheap newcomers (Creem, Polar) only after verifying KYC/payout path for a US LLC with a non-US owner.

### Cited Findings
- Managed Payments is a one-parameter switch on Checkout and supports `mode=payment`; Stripe Tax calculation is free on MP transactions in uncovered countries. — [Stripe docs: set up](https://docs.stripe.com/payments/managed-payments/set-up), [tax compliance](https://docs.stripe.com/payments/managed-payments/tax-compliance)
- Paddle: all-in 5% + 50¢, manual domain/business review, monthly payouts with $100 threshold. — [Paddle pricing](https://www.paddle.com/pricing), [payouts](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid)
- Non-MoR Stripe requires registering for Irish non-Union OSS (self-file or Tax Complete). — [Stripe docs](https://docs.stripe.com/tax/file-with-stripe-outside-us)
- Digital River is defunct; Lemon Squeezy is being folded into Managed Payments. — [Freemius](https://freemius.com/blog/digital-river-mycommerce-shutdown-guide/), [Lemon Squeezy blog](https://www.lemonsqueezy.com/blog/2026-update)

### Inferences
Ranking by use case (my judgement from the findings):
1. Lowest operational burden: Stripe Managed Payments (≈ +3.5% over Stripe fees; Stripe-hosted checkout only; buyer sees "Link"; no custom checkout domain; Stripe may refund within 60 days). Pair with Stripe webhooks already used by the site.
2. MoR with best price transparency: Paddle (5% + $0.50 fixed; no card-fee stacking; easiest ACH payouts to a US account; requires domain/business review and is software-oriented).
3. Most control and lowest fees at ≥1,000 sales/yr: Stripe Checkout + Stripe Tax with Irish non-Union OSS registration and either self-filing (free) or Tax Complete (~$1,080+/yr); LLC remains seller of record, issues its own VAT invoices (Stripe Invoicing 0.4% capped at $2 optional), handles VAT-ID reverse charge and chargebacks, and must monitor US state thresholds.
4. Value alternatives needing diligence: Creem (3.9% + 40¢), Polar Pro/Growth at higher volume.
5. Avoid: Lemon Squeezy for new builds (transition product), Gumroad (10%+), Xsolla (game-oriented, opaque), Digital River (defunct), Mollie/Adyen (no benefit for a US LLC).
- Because the LLC is non-EU, EU B2C VAT starts from the first sale (no OSS threshold for non-EU sellers) — a major reason MoR is attractive at low volume; at high volume paid managed filing wins.

### Gaps
- Legal/tax advice on Polish residency of the owner, LLC classification and US federal/state income tax, and the exact EU withdrawal-waiver wording are outside these sources and should be confirmed with a tax adviser/lawyer.
