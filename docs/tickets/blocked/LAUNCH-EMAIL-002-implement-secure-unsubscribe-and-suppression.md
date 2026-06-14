# LAUNCH-EMAIL-002 — Implement secure unsubscribe and suppression

Status: `SUPERSEDED_BY_SPLIT_TICKETS / HISTORICAL / NON_EXECUTABLE`
Type: historical broad runtime implementation ticket
Parent readiness ticket: `LAUNCH-EMAIL-001 — Email consent, unsubscribe and suppression readiness`
Do not execute. This broad ticket combined signed unsubscribe with bounce/complaint suppression and has been split.

Successors:

- Signed unsubscribe successor: `EMAIL-SIGNED-UNSUBSCRIBE-001`
- Suppression successor: `EMAIL-BOUNCE-COMPLAINT-SUPPRESSION-001`

## Blocked on

- Completed owner questionnaire: `docs/operations/email-consent-owner-questionnaire.md`
- Legal review decision.
- Approved marketing-vs-transactional classification for every current template and broadcast/manual/test/inbound surface.
- Approved unsubscribe semantics, including logged-out behavior, one-click behavior, scope of unsubscribe, and re-subscribe rules.
- Approved bounce/complaint policy, including provider-vs-local precedence and hard-bounce behavior.
- Decision whether schema change is allowed for unsubscribe tokens, suppression records, audit evidence, or retention metadata.
- Reconciliation with any merged `LAUNCH-SECURITY-001-security-boundary-audit-and-regression-pack` webhook/security changes.

## Strict collision note

- Security webhook changes must be merged and reconciled first.
- Implementation starts from then-current `main`.
- Do not copy stale branch code from this readiness PR or from any pre-security branch.
- Do not modify security-test or webhook code until ownership and collision risks are explicitly resolved.

## Goal

Implement owner-approved and legal-reviewed email unsubscribe and suppression behavior without changing patron access semantics.

Future implementation must preserve these invariants:

- `Subscription` is mailing/follow/newsletter consent only.
- `PatronGrant` is access truth and never grants newsletter consent.
- Payment/support does not automatically grant newsletter consent unless owner/legal explicitly approve and implementation records it safely.
- Transactional delivery permission and marketing consent are distinct concepts.
- Unsubscribe never removes or alters `PatronGrant`.

## Future secure implementation contract

Implementation must consider and test:

- public logged-out unsubscribe;
- no raw email in URL;
- token expiration policy;
- opaque random token, signed short payload, or another repository-compatible safe token method selected by implementation design review;
- idempotent unsubscribe;
- no account/email existence enumeration;
- generic success response;
- local preference update;
- provider contact update;
- broadcast suppression;
- complaint/bounce suppression;
- explicit re-subscribe behavior;
- transactional/marketing separation;
- audit evidence without excessive PII;
- no relationship to `PatronGrant` access;
- rate limiting;
- replay safety;
- focused tests.

## Confirmed defects/risk areas from readiness audit

- Email links currently include raw encoded email in `/unsubscribe?email=<encoded email>`.
- No public `app/**/unsubscribe/**` route was found.
- `DELETE /api/subscriptions` requires authenticated Clerk/app user context.
- `sendTemplateEmail` can attempt Resend contact creation with `unsubscribed:false` for all template sends when `RESEND_AUDIENCE_ID` is configured.
- Broadcast and policy gates default missing `EmailPreference` to marketing enabled.
- Bounce/complaint webhooks update broadcast-recipient status but no global suppression was confirmed.
- `EmailEvent` stores provider payload and recipient email; inbound email stores full content; logs may contain full emails/provider IDs.
- Welcome copy may overstate comment/rating permissions.

## Likely future runtime paths

Do not modify these paths until this ticket is unblocked and starts from then-current `main`:

- `app/unsubscribe/**` or approved equivalent public route
- `app/api/subscriptions/route.ts`
- `app/**/profile/settings/**` or approved preference route
- `app/components/SubscribeButton.tsx`
- `lib/modules/subscriptions/**`
- `lib/modules/email/**`
- `lib/services/email.service.ts`
- `app/api/webhooks/resend/**`
- `app/api/**/email/**`
- `prisma/schema.prisma` and `prisma/migrations/**` only if schema change is explicitly authorized as single-writer work
- focused email/unsubscribe/suppression tests
- relevant email templates and seed/ensure scripts only if explicitly authorized

## Schema-change decision point

Current models may not be sufficient for a safe tokenized logged-out unsubscribe flow, durable global suppression, provider/local reconciliation evidence, and retention/redaction policy. If implementation requires new token or suppression storage, schema and migrations are single-writer files and require explicit owner authorization before editing.

## Required validation when unblocked

Future implementation should include focused automated tests for:

- logged-out unsubscribe success;
- no raw email in links;
- idempotent repeat unsubscribe;
- generic response/no enumeration;
- local marketing suppression;
- provider unsubscribe/suppression update behavior with mocked Resend;
- bounce/complaint global suppression;
- no accidental re-subscribe after system/transactional template send;
- explicit re-subscribe behavior when owner-approved;
- no `PatronGrant` mutation;
- redacted logging/audit evidence.

Do not run or claim these validations in `LAUNCH-EMAIL-001`.

## Exit criteria

This ticket may move from `BLOCKED` to ready only after all blockers above are resolved. It may be executed only as a separate one-ticket, one-branch, one-PR runtime task.
