# Email setup (as of 2026-09-30)

No secrets here. Two separate jobs, two providers.

## Single public contact address: `hello@pawelperfect.pl`

The owner decided on **one** address for everything users see (legal documents, support, replies): `hello@pawelperfect.pl`. `support@` is not used anymore. In code it is `LEGAL_CONTACT_EMAIL` in `app/components/legal/LegalDocs.tsx` (guarded by `tests/unit/legal-docs-consistency.test.ts`). Older notes in CLAUDE.md and `docs/strategy/OWNER-*` that mention `support@…` or `@polutek.pl` are historical.

## Incoming mail and human replies: Google Workspace

- One Business Starter seat: `hello@pawelperfect.pl` (also the Workspace super admin; keep 2-step verification on).
- DNS at Cloudflare (set by Google's own integration): five `MX` records on `@` (`aspmx.l.google.com` and four `alt*.aspmx.l.google.com`), `TXT google-site-verification=…`, SPF `v=spf1 include:_spf.google.com ~all` on `@`.
- Still to do by the owner in admin.google.com: generate the Gmail DKIM key (Apps → Google Workspace → Gmail → Authenticate email) and give the `google._domainkey` TXT to be added in Cloudflare.
- Aliases are free and land in the same inbox if more names are ever wanted (`halo@`, `pomoc@`…); none are required.
- There is **no** helpdesk and no inbox inside the app. The admin inbound viewer (`/admin/emails`, `InboundEmail`) is no longer fed, because inbound mail no longer goes through Resend.
- Future AI support agent: build it on the Gmail API against this mailbox (threads, drafts, replies), drafts approved by the owner first. Treat every inbound message as untrusted input (prompt injection), avoid auto-reply loops (`Auto-Submitted`, skip `no-reply`), escalate payments/legal to the owner.

## Automatic mail from the app: Resend

- Domain `pawelperfect.pl` verified in Resend (DKIM `resend._domainkey`, bounce/SPF on the `send` subdomain). Sending only: the API key `polutek-production` is sending-only and scoped to this domain.
- Vercel env: `RESEND_API_KEY`, `EMAIL_FROM` (should be `PAWELPERFECT.PL <hello@pawelperfect.pl>` so replies reach the real mailbox; changing it needs a redeploy), `RESEND_WEBHOOK_SECRET`.
- Resend webhook `https://www.pawelperfect.pl/api/webhooks/resend` (delivery, delay, bounce, complaint). The `email.received` subscription is obsolete now that MX is at Google.
- Free plan: 100 mails/day, 3000/month.
