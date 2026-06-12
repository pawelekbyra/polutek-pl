# OWNER-LAUNCH-DECISIONS-001 — Consolidate launch-blocking owner decisions

ID: `OWNER-LAUNCH-DECISIONS-001`
Status: `READY_FOR_REVIEW`
Lane: docs/strategy
Type: docs-only consolidation

## Goal

Consolidate all remaining launch-blocking owner decisions, legal gaps, and email compliance requirements into a single reviewable document to unblock X7 Launch Certification.

## Context

This is the next agent-executable task because several implementation tickets depend on owner decisions. It is not the only remaining launch work. Production/operator evidence, email runtime implementation, X6.2–X6.8 and X7 remain outstanding. This ticket must not mark operator-evidence tickets complete.

## Owner decisions received

Date: 2026-06-12

## Progress

- [x] Product/tipping/access decisions recorded
- [x] Refund/dispute decision recorded
- [x] Email boundary decisions recorded
- [x] Language decision recorded
- [x] Privacy/contact direction recorded
- [x] Ops RPO/RTO and alert channel recorded
- [x] Cloudflare/original-file policy recorded
- [x] Launch scope recorded
- [x] Legal review boundary recorded
- [ ] Runtime implementation
- [ ] Operator evidence
- [ ] Legal copy publication
- [ ] X6.2–X6.8
- [ ] X7 certification

*Note: Unchecked items are outside the scope of this docs-only consolidation ticket.*

## Required Scope

- Consolidate the following into exactly one summary document:
  - **Legal readiness**: privacy policy provider list, terms of service alignment (permanent vs subscription wording).
  - **Email readiness**: public unsubscribe landing page requirement, suppression audit requirement, marketing consent policy.
  - **Payment policy**: partial refund impact on PatronGrant.
  - **Ops readiness**: alert channels, thresholds, RPO/RTO approval.
  - **Launch scope**: reactions/hearts critical status, mobile device baseline.
- Do not make the decisions; only present the options and current gaps.
- Do not modify runtime, tests, or schema.

## Allowed Paths

- `docs/strategy/**`
- `docs/reports/reconciliation/**` for the summary report
- `docs/tickets/ready/README.md` for index updates

## Validation

- `git diff --check`
- Confirm exactly one summary document is produced.

## Ticket Status

`READY_FOR_REVIEW`
