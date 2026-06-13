# LAUNCH-EMAIL-003 — Harden email consent boundary and Resend Audience runtime behavior

Status: NOT_ACCEPTED
Ticket ID: LAUNCH-EMAIL-003
Launch status: NO_GO

## Purpose

This ticket is the sole new runtime ticket currently executable through `docs/tickets/ready/README.md`.

**Candidate Implementation:**
- Branch: `launch-email-003-corrective-17820333385633550787`
- Status: PENDING REVIEW

Primary invariant: system/transactional email delivery must never create, enable, restore or mutate content-notification consent.

System emails must not add to Resend Audience.
Unsubscribe never revokes `PatronGrant`.
Public launch remains `NO_GO`.

## Background

Owner decisions have been recorded. This ticket implements only the narrow email-consent boundary required before later unsubscribe/suppression/email-event work. It must not implement the full launch email backlog.

## Absolute invariants

- System/transactional email delivery must never create, enable, restore or mutate content-notification consent.
- Missing content-notification preference means NOT OPTED IN.
- It must never be interpreted as implicit consent.
- System mail does not create a Resend Audience contact.
- System mail does not set `unsubscribed: false`.
- System mail does not clear an existing opt-out.
- System mail does not clear bounce/complaint state.
- Explicit subscribe remains the only opt-in path.
- Explicit unsubscribe remains functional.
- Unsubscribe never revokes `PatronGrant`.
- No `PatronGrant` mutation is allowed in this ticket.

## Suppression boundary

This ticket must preserve existing suppression/opt-out state and must not reset it.

This ticket does not implement a full new bounce/complaint webhook system.

Full suppression implementation and deliverability evidence are a separate later ticket/workstream.

## Non-goals

- signed unsubscribe token;
- unsubscribe landing page;
- full bounce/complaint webhook redesign;
- first-tip combined email implementation;
- new system-email events;
- language detection;
- referral emails;
- schema rename;
- legal copy;
- admin email-template redesign.

A focused test may confirm that a system first-tip mail does not write a subscription, but this ticket does not implement the combined first-tip template.

## Allowed paths

```text
lib/services/email.service.ts
lib/modules/email/**
lib/modules/subscriptions/**
app/api/subscriptions/**
tests/unit/modules/email/**
tests/unit/modules/subscriptions/**
tests/integration/**/email*
tests/integration/**/subscription*
docs/reports/reconciliation/LAUNCH-EMAIL-003-*.md
```

If a genuinely required implementation file is outside this allowlist,
Builder must return BLOCKED with the exact path and reason.
Builder must not broaden the allowlist autonomously.

## Disallowed paths

- Runtime outside the allowlist.
- `prisma/schema.prisma`.
- `prisma/migrations/**`.
- `package.json`.
- `package-lock.json`.
- Global docs except a ticket-specific reconciliation report under the allowed report path.

## Acceptance criteria

- system mail does not create Resend Audience contact;
- system mail does not set `unsubscribed: false`;
- system mail does not mutate local content consent;
- system mail does not clear opt-out;
- system mail does not clear bounce/complaint state;
- missing preference is not opted in;
- explicit subscribe remains the only opt-in path;
- explicit unsubscribe remains functional;
- no PatronGrant mutation;
- no schema/package change;
- focused tests pass.

## Required validation

Run the focused tests that cover changed email/subscription behavior, plus repository validation required by the ticket report. Do not claim full launch compliance from passing tests.

## Reconciliation report

The report may recommend whether LAUNCH-EMAIL-002 should be marked
SUPERSEDED, PARTIAL or HISTORICAL.

Only a later Integrator/queue reconciliation may change that ticket's
canonical classification.

## Out of scope for this ticket

- Public legal copy.
- Professional legal review.
- Operator evidence.
- X6.2–X6.8 evidence.
- X7 certification.
- Any launch status change.
