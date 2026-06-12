# LAUNCH-SECURITY-001 — Security boundary audit and regression pack

Status: COMPLETED_BY_BUILDER

## Owner authorization

This ticket was created from the owner prompt on 2026-06-12 for exactly one branch and one PR. It covers a current-main security-boundary audit and focused regression evidence only.

## Scope

Audit and add regression evidence for these current-main boundaries:

- authentication and identity resolution;
- admin authorization;
- PatronGrant-backed access truth;
- Stripe, Clerk, Cloudflare Stream and Resend webhook boundaries;
- private media-source and signed playback boundaries;
- comments/community mutation authorization;
- state-changing route protections;
- rate limiting;
- sensitive logging and error-response exposure;
- read-only security header/configuration observations.

## Allowed changes

- `tests/unit/security/**`
- `docs/operations/security-launch-verification-checklist.md`
- `docs/reports/reconciliation/LAUNCH-SECURITY-001-SECURITY-BOUNDARY-AUDIT.md`
- one narrow security follow-up ticket if required
- smallest route-local/runtime fix only for a proven current-main defect

## Explicit non-goals

- no broad refactor;
- no penetration-test claim;
- no public-launch certification claim;
- no schema, migration, package, build, legal, global roadmap or owner-policy changes;
- no live webhooks, live payments, production attacks or destructive database commands.

## Product invariants preserved

- Active `PatronGrant` remains the backend access truth.
- Payment/cache/newsletter/Clerk metadata signals alone do not grant patron access.
- Patronat remains a reward for qualifying one-time support, not a recurring subscription.
- Denied or non-ready playback returns no playable source, token, provider identifiers, session or view.
- Cloudflare Stream remains the active private playback provider.
- Comments remain public-read and patron/admin-write.

## Deliverables

- `tests/unit/security/launch-security-boundaries.test.ts`
- `docs/operations/security-launch-verification-checklist.md`
- `docs/reports/reconciliation/LAUNCH-SECURITY-001-SECURITY-BOUNDARY-AUDIT.md`
- `docs/tickets/ready/LAUNCH-SECURITY-002-cloudflare-webhook-authenticity-hardening.md`

## Validation commands

Run in this order:

```bash
npm test -- --run tests/unit/security/launch-security-boundaries.test.ts
npm test -- --run \
  tests/unit/api/media-source-route.test.ts \
  tests/unit/media-source-safety.test.ts \
  tests/unit/modules/payments/stripe-lifecycle-smoke.test.ts \
  tests/unit/admin-user-access-actions-ui.test.ts
npm test -- --run tests/integration/launch-candidate-critical-path.test.ts
git diff --check
npm run typecheck
npm run quality:architecture-boundaries
npm run lint
git diff | rg -n \
  "sk_live_|sk_test_|whsec_|postgres(ql)?://|DATABASE_URL=|password=|Bearer |api[_-]?key|secret|token=" \
  || true
```
