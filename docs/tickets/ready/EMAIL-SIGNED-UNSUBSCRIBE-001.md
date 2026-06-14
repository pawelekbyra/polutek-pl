# EMAIL-SIGNED-UNSUBSCRIBE-001 — Implement secure signed logged-out unsubscribe

Status: READY_FOR_BUILDER
Ticket ID: EMAIL-SIGNED-UNSUBSCRIBE-001
Role: Builder
Launch status: NO_GO

## Goal

Implement a secure, logged-out unsubscribe flow for content notifications.

The implementation must:

```txt
work without authentication
use a signed token
contain no raw email address in the public URL
be idempotent
avoid account or email enumeration
return generic success behavior
disable content-notification consent locally
never remove, revoke or modify PatronGrant
never treat registration, tipping or PatronGrant as subscription consent
not re-enable a previous opt-out
```

## Owner-policy basis

Owner decisions already establish:

```txt
content notifications require explicit user confirmation
registration does not subscribe
tipping does not subscribe
PatronGrant does not subscribe
unsubscribe must work without login
unsubscribe must not affect PatronGrant
unsubscribe URL must not expose a clear email address
```

Professional legal review remains required before public launch claims. This ticket must not claim legal compliance.

## Strict scope split

This ticket covers only:

```txt
signed unsubscribe token generation
token verification
public logged-out unsubscribe route/page
tokenized unsubscribe links in content-notification emails
local content-notification preference update
idempotency
generic non-enumerating responses
focused automated tests
```

This ticket must not implement:

```txt
bounce suppression
complaint suppression
provider-wide suppression reconciliation
global retention policy
legal copy certification
production deployment
unrelated email event redesign
PatronGrant changes
payment changes
Resend webhook authentication changes
```

## Token security requirements

The implementation must require:

```txt
a dedicated unsubscribe signing secret
purpose-bound signed payload
expiration
constant-time or library-safe signature verification
no raw email in the URL
no token or secret logging
safe invalid/expired/replayed behavior
```

A stateless signed token is preferred so this ticket does not require schema or migration changes.

Schema and migration changes are forbidden unless Bolek later issues an explicit revised ticket authorizing them.

Do not reuse the Resend webhook signing secret as the unsubscribe signing secret.

## Required discovery before implementation

Before modifying files, the Builder must inspect the current `main` implementation and identify the exact paths responsible for:

```txt
unsubscribe link generation
content-notification sending
Subscription records
EmailPreference updates
authenticated unsubscribe API
email templates
environment validation
```

The Builder must report those paths before modification in the PR report.

## Expected implementation areas

This ticket authorizes only paths proven relevant by discovery, likely including:

```txt
app/unsubscribe/**
app/api/subscriptions/**
lib/modules/subscriptions/**
lib/modules/email/**
lib/services/email.service.ts
focused unsubscribe tests
environment schema/example files required for the dedicated signing secret
relevant content-notification templates or link helpers
```

Unrelated modifications are forbidden.

## Forbidden changes

The Builder must not modify unrelated runtime, payment, patron, webhook, schema or global documentation areas.

Forbidden unless a later explicit revised ticket authorizes them:

```txt
bounce suppression
complaint suppression
provider-wide suppression reconciliation
global retention policy
legal copy certification
production deployment
unrelated email event redesign
PatronGrant changes
payment changes
Resend webhook authentication changes
prisma/schema.prisma
prisma/migrations/**
package.json
package-lock.json
.github/**
scripts/**
```

## Acceptance criteria

Focused automated evidence is required for:

```txt
valid logged-out unsubscribe succeeds
valid token disables content notifications
repeat unsubscribe remains successful and idempotent
URL does not contain a raw or encoded email address
invalid token returns generic safe response
expired token returns generic safe response
unknown recipient does not reveal account existence
handler does not modify PatronGrant
registration/tip/patron flows remain unrelated to subscription consent
system-email permission is not disabled by content unsubscribe
token and secret are never logged
missing signing-secret configuration fails safely
```

The implementation PR must require a later independent post-merge verification ticket after merge.

## Validation requirements

The Builder must run focused tests for the modified unsubscribe/content-notification paths and the repository control-plane check. Do not claim legal compliance or production launch readiness.

## Public launch status

Public launch remains:

```txt
NO_GO
```
