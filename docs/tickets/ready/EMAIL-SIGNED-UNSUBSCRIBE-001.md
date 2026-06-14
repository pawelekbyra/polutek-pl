# EMAIL-SIGNED-UNSUBSCRIBE-001 — Implement secure signed logged-out unsubscribe

Status: MERGED / IMPLEMENTATION_COMPLETE / VERIFICATION_PENDING / HISTORICAL
Ticket ID: EMAIL-SIGNED-UNSUBSCRIBE-001
Role: Builder / Historical implementation evidence
Launch status: NO_GO


## Historical executability statement

This ticket is no longer executable. PR #918 implemented this ticket and merged as implementation SHA `5710d14f82f5951c13d8d77f6a8eb4d899068c4b`. Independent post-merge verification is pending and is queued separately as `EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001`. Public launch remains `NO_GO`.

The requirements and acceptance criteria below are preserved for historical traceability only. They must not be read as authorization for a new Builder implementation task.

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
the public URL must not contain a raw or encoded email address
the signed token payload must not contain the email in plaintext, URL encoding, Base64 or another trivially reversible representation
the implementation must use an opaque non-PII subject or another repository-compatible privacy-preserving identifier
tokens, payloads, signatures and signing secrets must never be logged
safe invalid/expired/replayed behavior
```

A signature alone does not make an email address confidential. The Builder must not use a token format where decoding the token reveals the recipient email.

A stateless signed token is preferred so this ticket does not require schema or migration changes.

Schema and migration changes are forbidden unless Bolek later issues an explicit revised ticket authorizing them.

Do not reuse the Resend webhook signing secret as the unsubscribe signing secret.

## HTTP method and link-scanner safety

Email security scanners and preview systems may automatically follow GET links. Opening or scanning an email link must not unsubscribe the recipient.

The implementation must require:

```txt
GET must never change unsubscribe, Subscription, EmailPreference or consent state
GET may validate the token only enough to render a generic confirmation page
GET must not reveal whether the token or recipient exists
GET must not consume, invalidate or mutate the token
repeated or automated GET requests must be state-neutral
the unsubscribe mutation must require an explicit POST action
POST must be idempotent
invalid, expired, replayed or unknown-recipient POST requests must return generic safe behavior
```

The Builder must not require or implement a state-changing GET endpoint.

If standards-based one-click unsubscribe is later implemented, it must use an explicitly authorized POST mechanism and must not weaken the scanner-safe browser flow.

Focused automated evidence is required for:

```txt
GET with a valid token does not modify Subscription
GET with a valid token does not modify EmailPreference
GET does not trigger the unsubscribe mutation
multiple GET requests remain state-neutral
POST with a valid token performs the unsubscribe
repeated POST remains successful and idempotent
```

## Required discovery before implementation

Before modifying files, the Builder must inspect the current `main` implementation and identify the exact paths responsible for:

```txt
Subscription creation and deletion
EmailPreference fields and defaults
content-notification recipient selection
broadcast recipient selection
manual/admin recipient filtering
unsubscribe link generation
authenticated unsubscribe API
content-notification sending
email templates
environment validation
```

The Builder must report those paths before modification in the PR report.

Before implementation, the Builder must document:

```txt
which model represents explicit content-notification consent
which model is checked during recipient selection
whether Subscription and EmailPreference can currently disagree
which exact query or policy determines eligibility
```

## Local consent-state reconciliation requirements

The implementation must reconcile actual local consent sources discovered in the current repository state.

The implementation requirements are:

```txt
unsubscribe must reconcile every local state currently used to represent or evaluate content-notification consent
Subscription and EmailPreference must not remain in a contradictory eligible state
the current recipient-selection mechanism must exclude the unsubscribed recipient
missing local preference must not be treated as opted in
systemEmails must remain unchanged
PatronGrant must remain unchanged
```

Do not prescribe deleting a specific record before discovery confirms the repository’s actual consent model.

Do not implement provider-wide suppression or bounce/complaint handling in this ticket.

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
valid GET does not change state
automated or repeated GET does not unsubscribe
valid POST unsubscribes
repeat POST is idempotent
valid token disables content notifications
repeat unsubscribe remains successful and idempotent
URL does not contain a raw or encoded email address
token decoding does not expose an email address
invalid token returns generic safe response
invalid POST is generic and non-enumerating
expired token returns generic safe response
expired POST is generic and non-enumerating
unknown recipient does not reveal account existence
Subscription and EmailPreference do not remain contradictory after unsubscribe
the current recipient selector excludes the unsubscribed recipient
missing EmailPreference is not treated as consent
handler does not modify PatronGrant
PatronGrant is unchanged
registration/tip/patron flows remain unrelated to subscription consent
system-email permission is not disabled by content unsubscribe
systemEmails is unchanged
tokens, payloads, signatures, and signing secrets are never logged
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
