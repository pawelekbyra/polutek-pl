# EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001 — Independent post-merge verification for signed unsubscribe

Status: PASS / VERIFICATION_COMPLETE / MERGED / HISTORICAL
Ticket ID: EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001
Role: Reviewer / Certifier / Historical verification evidence
Launch status: NO_GO

## Historical verification result

This ticket is no longer executable. PR #920 independently verified the signed unsubscribe implementation and merged as verification SHA `77081b64073ec77bf1df13217622a0f88d118011` with verdict `PASS`.

```txt
verification PR #920
verification merge SHA 77081b64073ec77bf1df13217622a0f88d118011
verdict PASS
report docs/reports/verification/EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001.md
public launch remains NO_GO
```

The original verification requirements below are preserved for historical traceability only. They must not be read as authorization for another executable verification task.

## Purpose

Perform a strictly read-only independent post-merge verification of the signed logged-out unsubscribe implementation merged in PR #918.

The Reviewer / Certifier must inspect merged code directly on `main` and must not trust the Builder summary alone.

## Source implementation metadata

```txt
Source implementation ticket: EMAIL-SIGNED-UNSUBSCRIBE-001
Implementation PR: PR #918
Implementation merge SHA: 5710d14f82f5951c13d8d77f6a8eb4d899068c4b
Bolek implementation verdict: MERGE — KNOWN BASELINE CI FAILURES
Independent post-merge verification: PASS in PR #920
Public launch: NO_GO
```

## Strict read-only scope

This ticket is read-only verification only.

The Reviewer / Certifier must not commit:

```txt
runtime changes
test changes
workflow changes
environment changes
schema changes
migration changes
package changes
configuration repairs
```

A temporary uncommitted verification harness may be used, but the verification PR must contain only the evidence report unless a later Bolek decision explicitly permits otherwise.

The required evidence report path is:

```txt
docs/reports/verification/EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001.md
```

## Required independent inspection scope

Inspect at least these files on merged `main`:

```txt
app/unsubscribe/page.tsx
app/api/subscriptions/unsubscribe/route.ts
lib/modules/subscriptions/domain/signed-unsubscribe-token.ts
lib/modules/subscriptions/application/signed-unsubscribe.use-case.ts
lib/modules/subscriptions/infrastructure/email-preference.repository.ts
lib/modules/email/domain/email.policy.ts
lib/services/email.service.ts
lib/env/validation.ts
.github/workflows/ci.yml
tests/unit/modules/subscriptions/signed-unsubscribe.test.ts
tests/unit/modules/subscriptions/email-preference.repository.test.ts
tests/unit/modules/email/email-service-broadcast-consent-boundary.test.ts
tests/unit/modules/email/send-admin-broadcast-email.test.ts
```

## Required verification sections

### A. Token security

Verify that:

```txt
EMAIL_UNSUBSCRIBE_SIGNING_SECRET is dedicated to unsubscribe
the Resend webhook secret is not reused
the secret must contain at least 32 characters
HMAC-SHA256 is used
signature comparison is constant-time or library-safe
the token is purpose-bound to content-notification-unsubscribe
the token contains a version
the token contains expiration
the token subject is opaque User.id
the payload contains no raw email
the payload contains no URL-encoded email
the payload contains no Base64 or trivially reversible email
tampered signatures fail
wrong-purpose tokens fail
expired tokens fail
malformed tokens fail
missing-secret behavior fails safely
tokens, payloads, signatures and secrets are not logged
```

### B. Scanner-safe GET

Verify that:

```txt
GET /unsubscribe never changes Subscription
GET /unsubscribe never changes EmailPreference
GET does not call SignedContentUnsubscribeUseCase
GET does not consume or invalidate the token
repeated GET requests remain state-neutral
the page renders only a generic explicit POST confirmation form
the page does not reveal whether the token or recipient is valid
```

### C. Generic logged-out POST

Verify that:

```txt
POST /api/subscriptions/unsubscribe uses guest context
the token is accepted through the explicit POST form
valid POST invokes the unsubscribe use case once
invalid token returns generic safe behavior
expired token returns generic safe behavior
malformed token returns generic safe behavior
unknown recipient returns generic safe behavior
already-unsubscribed recipient returns generic safe behavior
responses do not enumerate account or recipient existence
errors, stack traces, emails and token data are not returned
```

### D. Atomic local consent reconciliation

Verify that one write transaction performs:

```txt
opaque User.id resolution
main-creator Subscription deletion
EmailPreference explicit content opt-out
```

Verify that:

```txt
EmailPreferenceRepository.recordExplicitContentOptOut(...) is used
direct email-based EmailPreference.upsert is not used by the signed unsubscribe use case
Subscription deletion and preference reconciliation use the same transaction
unexpected preference errors roll back the transaction
existing preference found by userId is updated
old-email preference is reconciled safely
compatible unowned email preference is handled safely
P2002 retry behavior is covered
missing preference is created opted out
marketingEmails becomes false
unsubscribedAt is populated
systemEmails=true remains true
systemEmails=false remains false
PatronGrant is not read, updated, deleted or revoked
repeated POST remains idempotent
```

### E. Recipient eligibility

Verify that content/broadcast eligibility requires both:

```txt
active main-creator Subscription
EmailPreference.marketingEmails === true
```

Verify that:

```txt
missing EmailPreference is not consent
marketingEmails=false excludes the recipient
missing Subscription excludes the recipient
an unsubscribed recipient is excluded by the actual send-time selector
manual/admin recipient creation cannot bypass the send-time eligibility checks
```

### F. Unsubscribe-link generation

Verify that broadcast content links use:

```txt
/unsubscribe?token=<signed-token>
```

Verify that:

```txt
the URL contains no raw email
the URL contains no encoded email
decoding the token payload reveals no email
recipient.userId is used as the opaque subject
recipient without a verifiable userId is skipped
missing signing-secret configuration prevents unsafe delivery
legacy /unsubscribe?email= links are not generated for content broadcasts
```

### G. Environment and CI

Verify that:

```txt
EMAIL_UNSUBSCRIBE_SIGNING_SECRET is required in production validation
.env.example documents the variable
the CI quality job provides only a deterministic CI test value
production validation was not weakened
CI workflow permissions and triggers were not broadened
```

## Required commands

Run at least:

```bash
npx vitest run \
  tests/unit/modules/subscriptions/signed-unsubscribe.test.ts \
  tests/unit/modules/subscriptions/email-preference.repository.test.ts \
  tests/unit/modules/email/email-service-broadcast-consent-boundary.test.ts \
  tests/unit/modules/email/send-admin-broadcast-email.test.ts
```

Also run:

```bash
npx vitest run \
  tests/unit/subscriptions-route.test.ts \
  tests/unit/modules/subscriptions/subscriptions-route-boundary.test.ts \
  tests/unit/modules/subscriptions/subscriptions.use-cases.test.ts \
  tests/unit/modules/subscriptions/signed-unsubscribe.test.ts
```

And run:

```bash
node scripts/check-control-plane-docs.mjs
npx prisma generate
npm run typecheck
npm run lint
git diff --check
```

Run production environment validation using complete dummy/test values, including `EMAIL_UNSUBSCRIBE_SIGNING_SECRET`.

Run `npx prisma validate` with valid test database environment values.

The Reviewer may run broader tests when useful.

Known unrelated repository baselines must be separated and must not be repaired in this verification ticket:

```txt
quality:strict-escapes
npm audit high
```

## Required verdict

The verification report must use exactly one verdict:

```txt
PASS
FIX_REQUIRED
BLOCKED
```

The report must not use `MERGE` as its verification verdict.

## Required evidence report content

The evidence report must include:

```txt
summary
implementation merge SHA
inspected files
token-security findings
GET scanner-safety findings
POST generic-response findings
transaction and consent-reconciliation findings
recipient-selection findings
unsubscribe-link privacy findings
environment and CI findings
commands and exact results
known unrelated baseline failures
explicit PASS / FIX_REQUIRED / BLOCKED verdict
confirmation that public launch remains NO_GO
follow-up tickets required by the verdict
```

## Public launch status

Public launch remains:

```txt
NO_GO
```
