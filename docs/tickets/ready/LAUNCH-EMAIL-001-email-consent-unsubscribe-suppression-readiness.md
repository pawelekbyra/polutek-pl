# LAUNCH-EMAIL-001 — Email consent, unsubscribe and suppression readiness

Status: `READY_FOR_OWNER_REVIEW`  
Runtime implementation status: `BLOCKED`  
Production evidence status: `PRODUCTION_EVIDENCE_REQUIRED`  
Type: docs-only, owner-authorized audit/readiness ticket  
Branch: `LAUNCH-EMAIL-001-email-consent-unsubscribe-suppression-readiness`  
Parallel Safety: `NON_EXECUTABLE_OWNER_REVIEW_ONLY / NOT_CURRENT_CODE_TICKET`

## Current-state reconciliation

This ticket is not the current executable code ticket and must not be used as one.

Current executable-ticket state is controlled only by `docs/tickets/ready/README.md`:

```txt
Current executable source: docs/tickets/ready/README.md
Current executable ticket: NONE
Queue status: NO_ACTIVE_LARGE_CODE_TICKET
Runtime implementation: BLOCKED
Production evidence: PRODUCTION_EVIDENCE_REQUIRED
Public launch: NO_GO
```

`READY_FOR_OWNER_REVIEW` means the docs-only readiness pack is ready for owner review. It does not mean runtime implementation is ready, production evidence is complete, or public launch is certified.

## Intent

Produce a decision-ready and implementation-ready audit of the current email lifecycle:

```txt
subscription consent
→ local preference
→ recipient selection
→ Resend contact state
→ broadcast delivery
→ unsubscribe
→ bounce/complaint suppression
→ optional re-subscription
```

This ticket documents confirmed current behavior, launch-critical gaps, owner decisions, legal-review questions, and the blocked implementation contract for `LAUNCH-EMAIL-002`.

## Scope

Allowed changed files for this ticket:

- `docs/tickets/ready/LAUNCH-EMAIL-001-email-consent-unsubscribe-suppression-readiness.md`
- `docs/operations/email-consent-owner-questionnaire.md`
- `docs/operations/email-unsubscribe-suppression-verification-checklist.md`
- `docs/reports/reconciliation/LAUNCH-EMAIL-001-EMAIL-CONSENT-UNSUBSCRIBE-SUPPRESSION-READINESS.md`
- `docs/tickets/blocked/LAUNCH-EMAIL-002-implement-secure-unsubscribe-and-suppression.md`

## Read-only inspection performed

Read-only inspection covered the requested paths and targeted related email/template code after discovery:

- `app/api/subscriptions/route.ts`
- `app/**/unsubscribe/**` discovery using `find app -path '*unsubscribe*' -print`
- `app/**/profile/settings/**` discovery using `find app -path '*profile/settings*' -print`
- `app/components/SubscribeButton.tsx`
- `app/components/**/*Subscribe*` and `app/components/**/*Newsletter*` via `rg --files`
- `lib/modules/subscriptions/**`
- `lib/modules/email/**`
- `lib/services/email.service.ts`
- `app/api/webhooks/resend/**`
- `app/api/**/email/**`
- `prisma/schema.prisma`
- `scripts/ensure-required-emails.ts`
- `prisma/seed.ts`
- `docs/operations/legal-owner-decision-questionnaire.md`
- `docs/reports/reconciliation/LAUNCH-LEGAL-001-LEGAL-PRIVACY-TERMS-READINESS-PACK.md`
- `lib/email-defaults.ts`
- focused email call sites in Clerk and payment fulfillment code

No broad unrelated audit of payments, playback, comments, or admin code was performed beyond locating email triggers.

## Confirmed current facts

- `DELETE /api/subscriptions` requires an authenticated app user before it can call `UnsubscribeUseCase`.
- Template emails and broadcast emails generate unsubscribe links shaped as `/unsubscribe?email=<encoded email>`.
- No `app/**/unsubscribe/**` route was found during this inspection.
- `sendTemplateEmail` sends via Resend and then attempts to create a Resend audience contact with `unsubscribed: false` whenever `RESEND_AUDIENCE_ID` is configured.
- The same template sending path is used for welcome, account deletion, password changed, donation thank-you, and patron-granted emails.
- Broadcast sending loads `EmailPreference`, but missing preference defaults to marketing enabled.
- `EmailPreference.marketingEmails` defaults to `true`; `EmailPreference.systemEmails` exists separately but was not found as an active send gate.
- Broadcast recipient statuses include `BOUNCED`, `COMPLAINED`, and `UNSUBSCRIBED`.
- Resend webhook handling stores `EmailEvent.email` and the full provider payload.
- Logs can include full recipient email addresses, Resend IDs, audience IDs, provider errors, and test recipient addresses.
- Welcome copy claims registered users can comment/rate, which may conflict with current patron/admin write rules for patron-only video interactions.

## Deliverables

- Readiness report: `docs/reports/reconciliation/LAUNCH-EMAIL-001-EMAIL-CONSENT-UNSUBSCRIBE-SUPPRESSION-READINESS.md`
- Owner questionnaire: `docs/operations/email-consent-owner-questionnaire.md`
- Verification checklist: `docs/operations/email-unsubscribe-suppression-verification-checklist.md`
- Blocked implementation ticket: `docs/tickets/blocked/LAUNCH-EMAIL-002-implement-secure-unsubscribe-and-suppression.md`

## Validation commands for this docs-only ticket

Only the requested validation commands may be run:

```bash
git diff --check
git status --short
git diff --name-only
```

Read-only evidence searches:

```bash
rg -n \
  "unsubscribeLink|marketingEmails|systemEmails|unsubscribedAt|unsubscribed|BOUNCED|COMPLAINED|RESEND_AUDIENCE_ID" \
  app lib prisma scripts docs

rg -n \
  "logger\.(info|warn|error).*email|recipient\.email|toEmail|fromEmail|EmailEvent|payload" \
  app lib prisma

rg -n \
  "/unsubscribe|api/subscriptions|profile/settings|SubscribeUseCase|UnsubscribeUseCase" \
  app lib docs
```

Do not run build, lint, typecheck, tests, migrations, seeds, or runtime commands for this docs-only task.

## Scope confirmation

This ticket does not modify runtime, webhooks, security tests, shared operational files, schema, migrations, package files, README, roadmap, strategy, specs, legal docs, or security docs.

## Collision note

A separate agent may be working on `LAUNCH-SECURITY-001-security-boundary-audit-and-regression-pack`. This ticket did not edit runtime webhook or security files. `LAUNCH-EMAIL-002` must start from then-current `main` after security webhook changes are merged and reconciled; no stale branch code may be copied forward.

## Ticket status

- Readiness pack: `READY_FOR_OWNER_REVIEW`
- Runtime implementation: `BLOCKED`
- Production evidence: `PRODUCTION_EVIDENCE_REQUIRED`
- Docs-only PR verdict: `MERGE`
