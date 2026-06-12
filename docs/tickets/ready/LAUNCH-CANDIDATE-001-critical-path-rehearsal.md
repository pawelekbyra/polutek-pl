# LAUNCH-CANDIDATE-001 — Integrated money-to-access-to-playback rehearsal

Status: `DONE` — merged on main (PR #878).

## Intent

Create one deterministic launch-candidate rehearsal for the Polutek.pl critical lifecycle:

```txt
qualifying one-time support
→ verified Payment fact
→ active PatronGrant
→ backend access allowed
→ READY Cloudflare VideoAsset
→ short-lived signed playback source
→ playback session/view only after successful resolution/start
```

The rehearsal also proves refund/dispute removal paths and denied/non-ready playback fail closed with no source, token, provider call, player/session or view side effects.

## Scope

Allowed implementation/evidence paths for this ticket:

- `tests/integration/launch-candidate-critical-path.test.ts`
- `docs/operations/launch-candidate-critical-path-rehearsal.md`
- `docs/reports/reconciliation/LAUNCH-CANDIDATE-001-CRITICAL-PATH-REHEARSAL.md`
- Narrow runtime correction in `lib/services/playback/playback.service.ts` only if the rehearsal exposes a critical leakage defect.
- Minimal test-runner configuration only to make the repository execute the requested `tests/integration/**` path.

## Product invariants under test

- Polutek.pl is one creator place, not a platform.
- Patron access is a lifetime/no-expiry reward for qualifying one-time support unless suspended/revoked.
- `Payment != PatronGrant != Subscription`.
- Active `PatronGrant` is backend access truth.
- `User.isPatron`, Clerk/cache metadata, newsletter subscription and Payment alone do not grant backend access.
- Cloudflare Stream is the first active private playback provider.
- Denied/non-ready playback must not return or expose playable source/token/provider call/session/view.
- Full refund, dispute lost and manual revoke must not be revived by later dispute-won events.
- Partial-refund policy remains `OWNER_DECISION_REQUIRED` and is not resolved here.

## Automated scenario matrix

The integrated Vitest harness covers:

| Scenario | Status | Evidence |
| --- | --- | --- |
| A — qualifying support unlocks patron playback | `IMPLEMENTED_VERIFIED` | Payment fulfillment, grant creation, PatronGrant truth, access, READY Cloudflare signing, session after token resolution, idempotent replay, view only after `WATCHED_10_SECONDS`. |
| B — below-threshold support does not unlock | `IMPLEMENTED_VERIFIED` | Payment fact remains; no grant/access/provider/session/view. |
| C — cache/payment/subscription signals alone do not unlock | `IMPLEMENTED_VERIFIED` | `User.isPatron`, mock Clerk metadata, successful Payment, active Subscription and revoked grant remain denied without provider/session/view. |
| D — anonymous and logged-in non-patron denial | `IMPLEMENTED_VERIFIED` | Safe current-main denial states and zero playback side effects. |
| E — asset not ready/missing primary | `IMPLEMENTED_VERIFIED` | `PENDING`, `PROCESSING`, `FAILED`, non-primary and no asset block playback and do not leak legacy URLs/provider IDs. |
| F — dispute opened suspends linked access | `IMPLEMENTED_VERIFIED` | Payment becomes `DISPUTED`; linked grant receives same-dispute marker; duplicate opened event is idempotent. |
| G — same-dispute won restores temporary suspension | `IMPLEMENTED_VERIFIED` | Same dispute ID reactivates only the matching temporary suspension. |
| H — dispute won cannot revive permanent/manual revocation | `IMPLEMENTED_VERIFIED` | Full refund/lost/manual revoke/reason mismatch/different dispute ID remain denied or not reactivated. |
| I — full refund removes linked access only | `IMPLEMENTED_VERIFIED` | Linked grant revoked; unrelated/manual grants untouched; duplicate refund idempotent. |
| J — duplicate/out-of-order financial events | `PARTIAL` | Duplicate payment/refund/open/won/lost and terminal won-after-refund/lost covered; unsupported old-event policy is documented as current behavior, not expanded. |
| K — isolation | `IMPLEMENTED_VERIFIED` | Payment/user/grant isolation across multiple users and grants. |

## Validation commands

Run focused validation:

```bash
npm test -- --run tests/integration/launch-candidate-critical-path.test.ts
npm test -- --run \
  tests/unit/modules/payments/stripe-lifecycle-smoke.test.ts \
  tests/unit/modules/payments \
  tests/unit/modules/patron \
  tests/unit/modules/access \
  tests/unit/media-source-safety.test.ts \
  tests/unit/api/media-source-route.test.ts \
  tests/unit/admin-user-access-actions-ui.test.ts \
  tests/unit/playback-plan-state-messaging.test.ts
git diff --check
npm run typecheck
npm run quality:architecture-boundaries
npm run e2e:list
npm run lint
```

`npm run vercel-build` is optional final evidence only when the environment supports external build requirements.

## Definition of done

- Ticket, integrated harness, operator runbook and reconciliation report exist.
- Denied/non-ready states prove zero provider/source/token/session/view side effects.
- UI admin confirmation/playback-state messaging regression evidence is present without adding dependencies or hidden production routes.
- Runtime leakage correction, if any, is minimal and directly tied to the failing rehearsal assertion.
- Production evidence is not fabricated.
- Exactly one next ticket is recommended in the reconciliation report.
