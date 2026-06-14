# EMAIL-BOUNCE-COMPLAINT-SUPPRESSION-001 — Durable bounce and complaint suppression

Status: PLANNED / DEFERRED / NON_EXECUTABLE / NEXT_AFTER_ADMIN_VIDEO_REPAIR
Ticket ID: EMAIL-BOUNCE-COMPLAINT-SUPPRESSION-001
Role: Builder / Planned
Launch status: NO_GO

## Deferred executability statement

This ticket is complete enough for later execution, but it is not the current executable ticket.
It becomes eligible only after `ADMIN-VIDEO-CLOUDFLARE-CREATE-FLOW-REPAIR-001` is implemented, independently verified and reconciled.

Next planned ticket after the urgent admin video repair: `EMAIL-BOUNCE-COMPLAINT-SUPPRESSION-001`.

## Goal

Implement durable local bounce and complaint suppression so a recipient suppressed by a verified Resend webhook cannot receive later content notifications or be silently reactivated by another send or provider synchronization.

The implementation must remain separate from:

```txt
signed unsubscribe consent
PatronGrant
system-email event redesign
production/provider configuration
legal certification
```

## Owner-policy basis

Existing owner decisions:

```txt
bounce and complaint suppression are launch-critical
complaint suppression cannot be automatically cleared by later synchronization
system emails cannot add a recipient to Resend Audience
system emails cannot set unsubscribed:false
Resend Audience synchronization is allowed only after explicit content-notification opt-in
a later system email cannot reverse a prior opt-out or suppression
content notifications require explicit user confirmation
registration, tipping and PatronGrant do not grant content-notification consent
```

## Existing runtime fact

Current merged runtime:

```txt
accepts email.bounced and email.complained events
marks the matching BroadcastEmailRecipient as BOUNCED or COMPLAINED
treats those recipient statuses as terminal
does not yet prove durable global suppression for future broadcasts/manual recipients
```

The Builder must inspect current `main` and must not trust historical audit descriptions alone.

## Required discovery before modification

Inspect and report the exact current paths responsible for:

```txt
Resend webhook route and Svix authentication
Resend webhook DTO normalization
handleResendWebhook event dispatch
EmailEventLockService idempotency
BroadcastEmailRecipient status updates
content-notification recipient selection
manual/admin recipient selection
send-time broadcast filtering
Resend Audience synchronization
EmailPreference consent state
system-template delivery
email schema and migrations
focused webhook and broadcast tests
```

At minimum inspect:

```txt
app/api/webhooks/resend/route.ts
lib/modules/email/application/handle-resend-webhook.use-case.ts
lib/modules/email/domain/email.dto.ts
lib/modules/email/infrastructure/email-event-lock.service.ts
lib/modules/email/domain/email.policy.ts
lib/modules/email/application/send-admin-broadcast-email.use-case.ts
lib/services/email.service.ts
prisma/schema.prisma
prisma/migrations/**
tests/unit/modules/email/handle-resend-webhook.test.ts
tests/unit/api/resend/resend-webhook-route.test.ts
tests/unit/modules/email/email-service-broadcast-consent-boundary.test.ts
tests/unit/modules/email/send-admin-broadcast-email.test.ts
```

The Builder must identify:

```txt
how the affected recipient email is obtained from each event
whether multiple recipients are possible
whether the current payload distinguishes bounce classes safely
whether an existing durable suppression model already exists
every content-notification send path that must consult suppression
every path that can synchronize a contact to Resend Audience
```

Do not invent unsupported provider payload fields.

## Durable suppression requirements

The solution must create or use a durable, globally queryable local suppression state independent from `Subscription` and explicit consent.

Required invariants:

```txt
complaint creates active durable suppression
bounce creates active durable suppression
duplicate webhook delivery is idempotent
reordered webhook delivery cannot clear suppression
normal subscribe actions cannot clear suppression
system emails cannot clear suppression
provider audience synchronization cannot clear suppression
missing EmailPreference cannot bypass suppression
an active Subscription plus marketingEmails=true cannot bypass suppression
manual/admin recipient input cannot bypass suppression
PatronGrant is never changed
```

Suppression and consent must remain distinct concepts:

```txt
Subscription / EmailPreference represent user content-notification consent
suppression represents a provider/deliverability safety block
suppression must override otherwise valid consent during send eligibility
```

This ticket must not implement automatic unsuppression. Any future recovery or manual unsuppression flow requires a separate explicitly authorized ticket.

## Schema authorization

A schema and migration change is authorized only if discovery confirms that no current model can represent durable global suppression safely.

If needed, the Builder may modify:

```txt
prisma/schema.prisma
prisma/migrations/**
```

The durable state must support at least:

```txt
global lookup for an outbound recipient
suppression reason: BOUNCE or COMPLAINT
active suppression state
first-seen timestamp
last-seen or updated timestamp
idempotent repeated events
privacy-minimized evidence
```

Do not store full provider webhook payloads in a new suppression record. Do not add unrelated retention, analytics or admin-management fields.

## Webhook processing requirements

For `email.bounced` and `email.complained`:

```txt
existing Svix authentication remains unchanged
existing provider event lock remains authoritative for event idempotency
recipient status update and durable suppression must be consistent
processing failure must return a retryable failure
the event must not be finalized as successful if suppression persistence failed
duplicates must not create duplicate suppression records
missing or malformed recipient data must fail safely and predictably
logs must not expose full webhook payloads or unnecessary PII
```

Do not weaken production webhook authentication or legacy fallback boundaries.

## Send-time enforcement

Content-notification delivery must perform a suppression check immediately before provider sending.

Enforce suppression in:

```txt
normal subscriber broadcasts
patron/non-patron content audiences when explicit content consent exists
manual/admin recipient broadcasts
any queued BroadcastEmailRecipient send path
Resend Audience synchronization for content notifications
```

An actively suppressed address must be skipped with a stable non-sensitive reason.

Do not silently mark a suppressed recipient as sent. Do not generate or send an unsubscribe link for an email that is skipped before delivery.

## System-email boundary

This ticket must not redesign system/transactional email events.

System-email behavior must remain separate, but system-email execution must never:

```txt
delete suppression
deactivate suppression
set a suppressed provider contact to unsubscribed:false
add a suppressed recipient to content-notification Audience
change Subscription
change PatronGrant
```

Do not introduce a new global rule blocking every transactional message unless a later ticket explicitly authorizes that product policy.

## Provider boundary

Do not require live Resend credentials for unit or CI tests.

Production provider reconciliation and operator evidence remain separate.

This implementation must ensure local send-time safety even if provider contact state is unavailable or disagrees with local state.

Do not claim production deliverability certification.

## Required automated evidence

Add focused tests for at least:

```txt
bounce creates durable suppression
complaint creates durable suppression
duplicate bounce is idempotent
duplicate complaint is idempotent
reordered lower-priority events do not clear suppression
suppression persistence failure makes webhook processing fail/retry
existing recipient status updates still work
suppressed recipient is excluded at send time
suppressed manual recipient is excluded
active Subscription cannot bypass suppression
marketingEmails=true cannot bypass suppression
missing EmailPreference cannot bypass suppression
normal subscribe does not clear suppression
system email does not clear suppression
Resend Audience synchronization does not clear suppression
PatronGrant is never modified
logs and responses do not expose unnecessary PII
```

If schema changes are used, add real PostgreSQL integration evidence for:

```txt
migration applies successfully
unique/idempotent suppression behavior
transaction rollback or consistency when suppression persistence fails
```

## Validation requirements

Run at minimum:

```bash
npx vitest run tests/unit/modules/email/handle-resend-webhook.test.ts
npx vitest run tests/unit/api/resend/resend-webhook-route.test.ts
npx vitest run \
  tests/unit/modules/email/email-service-broadcast-consent-boundary.test.ts \
  tests/unit/modules/email/send-admin-broadcast-email.test.ts
node scripts/check-control-plane-docs.mjs
npx prisma validate
npx prisma generate
npm run typecheck
npm run lint
git diff --check
```

When schema changes are made, also run repository PostgreSQL integration/smoke validation and include the migration in CI-compatible form.

Known unrelated baselines must remain separate:

```txt
quality:strict-escapes
npm audit high
```

## Forbidden changes

Do not modify or redesign:

```txt
signed-unsubscribe token or route
PatronGrant or payment logic
system-email event catalog
referral notifications
language persistence
legal copy
production Resend configuration
Svix authentication policy
Cloudflare, Stripe or Vercel runtime
admin unsuppression UI
automatic suppression clearing
```

Do not modify:

```txt
package.json
package-lock.json
.github/**
scripts/**
```

unless Bolek later explicitly revises the ticket.

## Completion contract

The implementation PR must require a later independent post-merge verification ticket.

Public launch remains:

```txt
NO_GO
```
