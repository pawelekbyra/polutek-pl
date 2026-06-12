# LAUNCH-CANDIDATE-001 — Critical-path rehearsal reconciliation

## 1. Summary

`IMPLEMENTED_VERIFIED` locally for the automated money-to-access-to-playback critical path. This ticket adds a deterministic integrated Vitest rehearsal and an operator runbook. It also applies one minimal runtime safety correction: public playback plan asset diagnostics now redact provider asset/playback IDs so denied and non-ready plans cannot expose private provider identifiers.

This report does not claim production proof and does not call the product launch-ready.

## 2. Baseline main SHA

Baseline current-main/work SHA inspected before changes:

```txt
7ae657b6512e022fb3803f8921ae385c8dc0cebf
```

Remote sync was unavailable because the local checkout has no `origin` remote. The local branch started from the checked-out current `work` branch at the merge commit above, which is the latest available current-main equivalent in this container.

## 3. Ticket and scope

Ticket created:

```txt
docs/tickets/ready/LAUNCH-CANDIDATE-001-critical-path-rehearsal.md
```

Scope status: `IMPLEMENTED_VERIFIED` for automated local evidence; `IMPLEMENTED_UNVERIFIED` for production/operator execution.

## 4. Current contracts inspected

Inspected implementation and historical reports:

- `AGENTS.md`
- `lib/modules/payments/application/handle-stripe-webhook.use-case.ts`
- `lib/modules/payments/application/fulfill-payment.use-case.ts`
- `lib/modules/payments/application/handle-refund.use-case.ts`
- `lib/modules/payments/application/handle-dispute.use-case.ts`
- `lib/modules/payments/domain/payment.policy.ts`
- `lib/modules/payments/infrastructure/payment.repository.ts`
- `lib/modules/patron/application/get-patron-status.use-case.ts`
- `lib/modules/patron/application/grant-patron.use-case.ts`
- `lib/modules/patron/application/revoke-patron.use-case.ts`
- `lib/modules/patron/application/recalculate-patron-status.use-case.ts`
- `lib/modules/patron/infrastructure/patron.repository.ts`
- `lib/modules/access/application/check-video-access.use-case.ts`
- `lib/services/playback/playback.service.ts`
- `lib/services/playback/playback.dto.ts`
- `lib/modules/video/infrastructure/cloudflare-stream.client.ts`
- `lib/modules/video/infrastructure/video-playback.repository.ts`
- `lib/modules/video/application/record-playback-event.use-case.ts`
- `app/api/media-source/[videoId]/route.ts`
- `app/components/PremiumWrapper.tsx`
- `app/admin/users/UserPatronActions.tsx`
- `app/admin/users/AdminAccessDiagnostics.tsx`
- `docs/reports/reconciliation/LAUNCH-FIX-007-STRIPE-REFUND-DISPUTE-PATRONGRANT-LIFECYCLE-SMOKE-TEST.md`
- `docs/reports/reconciliation/X3-FIX-011-CLOUDFLARE-SIGNED-PLAYBACK-RUNTIME.md`
- `docs/reports/reconciliation/X6-FU-001-ADMIN-ACCESS-ACTIONS-CONFIRMATION.md`
- `docs/reports/reconciliation/X6-FU-002-PLAYBACK-PLAN-STATE-MESSAGING.md`
- `docs/reports/reconciliation/DOCS-RECONCILE-001-CURRENT-MAIN-SOURCE-OF-TRUTH.md`

Historical reports were used as historical evidence only; current code/tests were treated as implementation truth.

## 5. Integrated harness design

Status: `IMPLEMENTED_VERIFIED`.

The harness in `tests/integration/launch-candidate-critical-path.test.ts` uses real current-main use cases/services for:

- payment fulfillment eligibility,
- payment status and totals updates,
- PatronGrant creation/revocation/recalculation,
- PatronGrant-backed access checks,
- refund and dispute lifecycle,
- PlaybackService ordering,
- Cloudflare signed playback resolution boundary,
- playback session creation,
- playback event/view boundary,
- source-based UI contract evidence.

Mocked boundaries only:

- Cloudflare token network call,
- Clerk access synchronization,
- email provider,
- observability/logging,
- rate-limit view dedupe,
- currency settings DB default lookup.

A deterministic in-memory Prisma-shaped adapter is used instead of live Stripe/Cloudflare/database calls.

## 6. Scenario evidence matrix

| Scenario | Verdict | Evidence |
| --- | --- | --- |
| A qualifying support unlocks patron playback | `IMPLEMENTED_VERIFIED` | Fulfillment records Payment as `SUCCEEDED`, creates exactly one linked active grant, status/access derive from active grants, Cloudflare signing resolves a short-lived iframe source, and session/view happen only after resolution/start. |
| B below-threshold support does not unlock | `IMPLEMENTED_VERIFIED` | Below-threshold Payment remains financial fact; no grant, access, provider call, session or view. |
| C stale signals alone do not unlock | `IMPLEMENTED_VERIFIED` | `User.isPatron`, mock Clerk metadata, successful Payment without active grant, Subscription and historical revoked grant remain denied. |
| D guest/non-patron denial | `IMPLEMENTED_VERIFIED` | Current-main safe denial states are returned with no provider/session/view side effects. |
| E non-ready/missing asset | `IMPLEMENTED_VERIFIED` | `PENDING`, `PROCESSING`, `FAILED`, non-primary and missing asset block playback; no legacy fallback or provider ID leakage. |
| F dispute opened | `IMPLEMENTED_VERIFIED` | Linked grant receives same-dispute temporary revocation marker; duplicate open is idempotent. |
| G same-dispute won | `IMPLEMENTED_VERIFIED` | Matching temporary suspension is cleared; unrelated grants remain untouched. |
| H dispute won cannot revive terminal/manual revocation | `IMPLEMENTED_VERIFIED` | Full refund, chargeback lost, manual revoke, reason mismatch and different dispute ID remain unreanimated. |
| I full refund | `IMPLEMENTED_VERIFIED` | Linked grant revoked; unrelated/manual grants unaffected; duplicate refund idempotent. |
| J duplicates/out-of-order | `PARTIAL` | Reasonable supported duplicate/open/won/lost/refund combinations covered. Current code still has no explicit owner policy for partial refunds and some old-event semantics; no speculative policy added. |
| K isolation | `IMPLEMENTED_VERIFIED` | Events for one payment/user do not mutate another payment/user; one revoked grant does not hide another active grant. |

## 7. Event-ordering evidence

Status: `PARTIAL`.

Covered:

- duplicate payment success,
- duplicate full refund,
- duplicate dispute opened,
- duplicate dispute won through same-dispute idempotent restoration,
- duplicate dispute lost,
- dispute won after full refund,
- dispute won after chargeback lost,
- old dispute opened after terminal lost.

`OWNER_DECISION_REQUIRED`: partial-refund access policy remains unresolved by instruction.

## 8. Provider-call ordering evidence

Status: `IMPLEMENTED_VERIFIED`.

The rehearsal asserts Cloudflare token signing is called only after:

1. PatronGrant-backed access is allowed, and
2. a primary Cloudflare asset is `READY`.

Denied users, stale-signal users, below-threshold users, non-ready assets and missing/non-primary assets all produce zero Cloudflare calls and zero sessions/views.

## 9. Negative leakage evidence

Status: `IMPLEMENTED_VERIFIED`.

The rehearsal asserts denied/non-ready plans do not include:

- playable source,
- token,
- session ID,
- view event,
- raw legacy private URL,
- private Cloudflare provider asset/playback IDs.

Runtime correction: `toSafeAssetContract` in `lib/services/playback/playback.service.ts` now redacts provider identifiers in public playback plan asset diagnostics.

## 10. PatronGrant truth evidence

Status: `IMPLEMENTED_VERIFIED`.

Evidence confirms `getPatronStatus` and `checkVideoAccess` use active PatronGrant truth. Payment, `User.isPatron`, mock Clerk metadata and Subscription/newsletter signals do not grant access without an active grant.

## 11. UI regression evidence

Status: `IMPLEMENTED_VERIFIED` by source-contract tests.

No new Playwright test was added because the repository has no existing non-production route that exercises these private playback states without adding a hidden test route, and the task forbids adding such a route or new component-test dependencies.

Source assertions verify:

- no browser `prompt()` in admin access actions,
- structured dialog use,
- non-empty reason gating,
- cancel/no-submit and pending duplicate guard implementation contract,
- destructive revoke styling/copy,
- access impact copy,
- diagnostics state PatronGrant truth and Payment/User cache/Subscription non-truth,
- blocked playback states render blocked path,
- READY can render children/player path,
- blocked overlay does not request media-source or expose playback/provider fields,
- patron copy says one-time support, not recurring subscription,
- login/support/retry controls have keyboard-accessible implementation contracts.

## 12. Automated validation results

Recorded in this PR:

- `IMPLEMENTED_VERIFIED`: `npm test -- --run tests/integration/launch-candidate-critical-path.test.ts` passed: 1 file / 5 tests.
- `IMPLEMENTED_VERIFIED`: focused related unit suites passed: 16 files / 96 tests.
- `IMPLEMENTED_VERIFIED`: `git diff --check` passed.
- `IMPLEMENTED_VERIFIED`: `npm run typecheck` passed.
- `IMPLEMENTED_VERIFIED`: `npm run quality:architecture-boundaries` passed with existing allowlist warnings.
- `IMPLEMENTED_VERIFIED`: `npm run e2e:list` listed 19 tests.
- `IMPLEMENTED_VERIFIED`: `npm run lint` passed with an existing warning in `app/admin/videos/page.tsx` about `migrationStatusFilter`.
- `IMPLEMENTED_UNVERIFIED`: `npm run vercel-build` was attempted and failed because Next/font could not fetch Google Fonts (`Gluten`, `Inter`, `Outfit`, `Plus Jakarta Sans`, `Space Grotesk`) from `fonts.googleapis.com` in this environment. No font/build workaround was made.

## 13. Manual/production runbook status

Status: `IMPLEMENTED_UNVERIFIED`.

Runbook created:

```txt
docs/operations/launch-candidate-critical-path-rehearsal.md
```

It has not been executed against a named preview or production-like deployment in this task, so no production proof is claimed.

## 14. What remains `IMPLEMENTED_UNVERIFIED`

- Production Stripe webhook delivery proof.
- Production/preview Cloudflare token playback proof.
- Browser-network proof against a named deployment.
- Admin diagnostics screenshots/logs from a named deployment.
- Operator rollback/escalation drill evidence.

## 15. Owner decisions not resolved

- Partial refund access policy: `OWNER_DECISION_REQUIRED`.
- Production-safe Stripe procedure if not using test mode: `OWNER_DECISION_REQUIRED`.
- Any public-launch certification decision: `OWNER_DECISION_REQUIRED`.

## 16. Files changed

- `docs/tickets/ready/LAUNCH-CANDIDATE-001-critical-path-rehearsal.md`
- `tests/integration/launch-candidate-critical-path.test.ts`
- `docs/operations/launch-candidate-critical-path-rehearsal.md`
- `docs/reports/reconciliation/LAUNCH-CANDIDATE-001-CRITICAL-PATH-REHEARSAL.md`
- `lib/services/playback/playback.service.ts`
- `vitest.config.ts`

## 17. What did not change

No schema, migrations, package files, global README/AGENTS/roadmap/timeline, CI workflows, environment files, provider credentials, legal copy, unrelated comment/email/admin-video UI, Cloudflare upload/import implementation or owner decisions were changed.

## 18. Risks

- The integrated harness is deterministic but in-memory; it is not production evidence.
- Source-based UI assertions are intentionally narrow and are not a substitute for owner/browser execution.
- `vitest.config.ts` was minimally updated so the requested `tests/integration/**` path is executable by the existing `npm test` command.

## 19. Blockers

No automated local blocker remains for this ticket.

Production/manual evidence remains blocked on owner/operator execution of the runbook against a named environment.

## 20. Recommended next ticket

Exactly one recommended next ticket:

```txt
LAUNCH-CANDIDATE-002-preview-production-critical-path-evidence-pack
```

Goal: execute this runbook against a named preview or production-like environment and collect redacted X7 evidence without changing runtime behavior.

## 21. Verdict

`MERGE`
