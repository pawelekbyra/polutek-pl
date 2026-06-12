# LAUNCH-EMAIL-003 — Harden email consent boundary and Resend Audience runtime behavior

- **Ticket ID**: LAUNCH-EMAIL-003
- **Lane**: Email & Subscriptions
- **Phase**: X7 Launch Readiness
- **Type**: Runtime fix
- **Status**: READY
- **Parallel Safety**: Unsafe with other email/subscription/runtime mail delivery tickets
- **Conflicts with**: LAUNCH-EMAIL-002, any ticket editing the same email subscription, unsubscribe, suppression, or Resend bridge modules
- **Can run with**: Docs-only or operator-evidence tickets that do not touch email runtime or shared test suites
- **Owner role**: Builder

## Goal

Implement the owner-decided email consent boundary in runtime so system/transactional email delivery cannot create or reset content-notification consent, cannot silently add users to Resend Audience, and cannot undo an unsubscribe/suppression state.

## Context

`OWNER-LAUNCH-DECISIONS-001` decided that system email is separate from content notifications/referral notifications, system email must not auto-add recipients to Resend Audience or set `unsubscribed: false`, and secure unsubscribe/suppression remains launch-critical. The current decision-control-plane hardening keeps public launch as `NO_GO` until this is implemented, tested, and reconciled with legal/operator evidence.

This ticket is the sole new runtime ticket created by the decision-control-plane hardening task. It does not authorize legal copy publication, package/schema changes, or a subscription-to-patron shortcut.

## Product Invariants

- `Subscription` / content-notification consent is mailing consent only.
- Patron access is based on active `PatronGrant`, never newsletter/content consent.
- A patron is not automatically subscribed to marketing/content notifications.
- Unsubscribe never revokes `PatronGrant`.
- Transactional/system emails are separate from marketing/content notifications.
- System emails must not add to Resend Audience, set `unsubscribed: false`, or reverse a prior opt-out/suppression.
- Content notifications require separate, conscious opt-in; the owner decision does not mandate a specific checkbox UI.

## Allowed Files

- `app/**/email*/**`
- `app/**/unsubscribe*/**`
- `app/**/subscription*/**`
- `app/**/newsletter*/**`
- `components/**/email*/**`
- `components/**/subscription*/**`
- `lib/**/email*/**`
- `lib/**/subscription*/**`
- `lib/**/resend*/**`
- `tests/**/email*/**`
- `tests/**/subscription*/**`
- Existing email/subscription test files needed to cover this behavior
- `docs/reports/reconciliation/**` for the ticket report only

## Forbidden Files

- `README.md`
- `AGENTS.md`
- `docs/strategy/OWNER-DECISIONS.md`
- `docs/strategy/OWNER-LAUNCH-DECISIONS-001.md`
- `docs/roadmap/**`
- `docs/tickets/ready/README.md`
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `scripts/check-architecture.ts`

## Required Steps

1. Inventory the current system-email, content-notification, unsubscribe, suppression, and Resend Audience paths before editing.
2. Ensure transactional/system email sending does not create content-notification consent, does not add to Resend Audience, and does not reset unsubscribe/suppression state.
3. Ensure content-notification subscription changes happen only through explicit content-notification opt-in flows.
4. Ensure unsubscribe and suppression behavior is idempotent and cannot remove or revoke `PatronGrant`.
5. Add focused tests for negative boundaries: system email delivery, first qualifying tip / `FIRST_TIP_AND_PATRON_GRANTED`, later system emails, unsubscribe, bounce/complaint suppression, and existing subscriber behavior.
6. Produce a reconciliation report under `docs/reports/reconciliation/**` that lists implemented behavior, validations, known gaps, and whether LAUNCH-EMAIL-002 remains blocked or can be superseded.

## Validation Commands

```bash
git diff --check
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run
```

Add and run any narrower email/subscription test command introduced or touched by the implementation.

## Definition of Done

- [ ] System/transactional emails do not mutate content-notification consent or Resend Audience membership.
- [ ] Explicit opt-in remains the only route into content notifications / Resend Audience sync.
- [ ] Unsubscribe/suppression does not affect `PatronGrant`.
- [ ] Negative tests cover the consent boundary.
- [ ] Reconciliation report documents what changed and what remains launch-blocking.
- [ ] Public launch remains `NO_GO` unless X7 certification evidence is separately produced.

## Stop Conditions

- A schema or migration change appears necessary.
- A package dependency change appears necessary.
- The implementation would require changing owner policy, legal copy, global roadmap, or control-plane docs.
- The runtime currently cannot distinguish transactional from content-notification paths without a broader architecture decision.
- Tests reveal patron access is derived from subscription/email state.

## Final Report Requirements

- Summary, intent, and changed files.
- Validation commands with result.
- Scope confirmation and what did not change.
- Risks and follow-ups.
- Ticket status recommendation: `MERGE`, `FIX`, `BLOCKED`, or `REJECT`.
