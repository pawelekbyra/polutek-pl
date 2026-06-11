# LAUNCH-FIX-005 — Comments Public-Read / Patron-Write Smoke Test

## Status

Merge recommendation: **MERGE**.

Ticket/task: `LAUNCH-FIX-005-comments-public-read-patron-write-smoke-test`.

Lane verdict: **launch-candidate** for automated comments-lane smoke evidence, with production manual smoke still required before final public-launch certification.

## Intent

Create focused smoke-style evidence for the comments launch invariant:

```txt
Comments are publicly readable, including under patron-only videos.
Write/react/report actions remain gated for guests and non-patrons.
Patrons/admins can interact where policy allows.
Display-only patron badge state does not grant viewer permissions.
```

This PR does **not** certify production deployment state or real account/video availability. It adds repository-level automated evidence and documents remaining manual smoke checks.

## Sources inspected

- `docs/reports/reconciliation/LAUNCH-OPS-001-PRODUCTION-ENV-AND-SMOKE-TEST-INVENTORY.md`
- `docs/tickets/ready/LAUNCH-FIX-005-comments-public-read-patron-write-smoke-test.md`
- `docs/reports/reconciliation/X4-READY-001-COMMENTS-PUBLIC-READ-PATRON-WRITE-INVENTORY.md`
- `docs/reports/reconciliation/X4-FIX-001-COMMENT-READ-PRODUCT-CONTRACT.md`
- `docs/reports/reconciliation/X4-FIX-003-COMMENT-BADGE-TRUTH-HARDENING.md`
- `docs/reports/reconciliation/X4-FIX-004-COMMENT-ACCESS-TRUTH-NEGATIVE-TESTS.md`
- Existing `tests/unit/modules/comments/**` coverage

Note: no `X4-FIX-002` reconciliation report was present under `docs/reports/reconciliation/` at execution time.

## Scope confirmation

Changed files:

- `tests/unit/modules/comments/core-flows.test.ts`
- `tests/unit/modules/comments/patron-grant-write-access.test.ts`
- `docs/reports/reconciliation/LAUNCH-FIX-005-COMMENTS-PUBLIC-READ-PATRON-WRITE-SMOKE-TEST.md`

No production runtime code was changed. No video, payment, patron, access, user, Prisma schema, migration, package, roadmap, strategy, README, AGENTS, or architecture-guard files were changed.

## Smoke cases covered

| Case | Automated evidence | Result |
| --- | --- | --- |
| Public video comments are readable by guest | Existing focused case in `patron-grant-write-access.test.ts` confirms anonymous public-video comment listing remains allowed and does not require PatronGrant lookup. | PASS |
| Patron-only video comments are readable by guest | Existing/extended focused cases confirm guest listing succeeds on patron-only comments while viewer interaction flags are disabled. | PASS |
| Patron-only video comments are readable by logged-in non-patron | Existing/extended focused cases confirm non-patron listing succeeds while write/react/report flags remain disabled. | PASS |
| Guest cannot create comment | Existing focused case confirms guest creation returns `UNAUTHORIZED` and does not create a comment. | PASS |
| Guest cannot react/like | Existing focused case confirms guest reaction returns `UNAUTHORIZED` and does not create a reaction. | PASS |
| Guest cannot report | Added focused smoke case confirms guest report returns `UNAUTHORIZED` and does not create a report. | PASS |
| Logged-in non-patron cannot create on patron-only video | Existing focused case confirms non-patron creation returns `FORBIDDEN` and does not create a comment. | PASS |
| Logged-in non-patron cannot react/report on patron-only video | Added focused smoke case confirms non-patron reaction and report both return `FORBIDDEN` and do not create reaction/report rows. | PASS |
| Patron can create/react/report where policy allows | Added focused smoke case confirms active PatronGrant allows create, like, and report on patron-only comments. | PASS |
| Admin behavior remains allowed where existing policy allows | Added focused smoke case confirms admin create, like, and report stay allowed without PatronGrant lookup; existing module tests continue to cover moderation/pin/delete behavior. | PASS |
| Stale author badge / `User.isPatron` does not grant viewer permissions | Existing focused case confirms stale `User.isPatron` / displayed `PATRON` badge can render as display-only while edit/delete/report/create/react permissions remain denied without active grants. | PASS |
| Stale legacy core test aligned to public-read contract | Updated older core-flow expectation from legacy patron-read denial to public-read success with guest interaction flags disabled. | PASS |

## Evidence summary

- `patron-grant-write-access.test.ts` now acts as the focused launch smoke/evidence file for comment access truth: public read stays open, guest/non-patron writes are denied, PatronGrant-backed patrons can interact, and admins bypass PatronGrant where policy allows.
- `core-flows.test.ts` no longer encodes the pre-X4 legacy expectation that `PATRON_REQUIRED` blocks reading comments. It now asserts the launch contract: public read succeeds while guest write/react/report flags remain false.
- Full `tests/unit/modules/comments` passes after aligning the stale core-flow expectation.
- Architecture-boundary guard passes; its warnings are allowlisted temporary route-service imports and are not introduced by this PR.

## Test commands run

- `npm test tests/unit/modules/comments/patron-grant-write-access.test.ts` — PASS, 1 file / 15 tests passed.
- `npm test tests/unit/modules/comments` — PASS, 8 files / 68 tests passed.
- `npm run quality:architecture-boundaries` — PASS, with existing allowlisted warnings only.
- `git diff --check` — PASS.

## Typecheck

`npm run typecheck` was **not run** for this PR because the prompt explicitly said to run it only if the parallel X3 typecheck stabilizer had already landed. At execution time, another Codex agent was still working on `STABILIZE-X3-TYPECHECK-001-fix-video-cloudflare-typecheck-regression`, and this task forbids touching the affected video/provider files.

Known unrelated blocker from prior X4 evidence: repository typecheck had an unrelated Cloudflare/video `VideoAsset` Prisma client/schema mismatch in forbidden video paths. This PR does not modify those paths.

## What remains manual

Before final launch certification, run production/staging manual smoke with real non-secret evidence:

- Guest opens a published public video and sees comments.
- Guest opens a published patron-only video and sees comments but cannot create, react, or report.
- Signed-in non-patron opens a published patron-only video and sees comments but cannot create, react, or report.
- Patron account with an active `PatronGrant` creates, reacts, and reports where policy allows.
- Admin account creates and moderates where policy allows.
- Network/API observation confirms denied actors do not receive mutation success responses.
- Capture video identifiers, account role labels, deployment URL/build ID, and timestamps without exposing secrets or private account data.

## Blockers found

No comments-lane production bug was found by the focused automated smoke tests.

Operational blocker still outside this PR: production account/video availability and deployment-environment evidence remain manual and must be collected before final public-launch certification.

## Risks

- Automated smoke evidence uses unit-level app use cases and mocked persistence/provider boundaries. It is strong policy evidence, but it does not replace browser/network production smoke.
- Admin report behavior is preserved as allowed by current policy when the admin is not reporting their own comment; moderation-specific behavior remains covered by existing comment tests rather than broadened here.
- The source ticket file is docs-only, while the explicit task prompt allowed focused comment tests. This PR follows the explicit task scope and keeps changes confined to allowed comment test files plus this reconciliation report.

## Follow-ups / next recommended ticket

Next recommended ticket: execute the production/staging manual comments smoke checklist from this report and attach environment-safe evidence, after the X3 typecheck stabilizer lands and the target deployment is updated.

## Ticket status

`LAUNCH-FIX-005` automated repository smoke evidence is complete. Production manual smoke evidence remains pending as a launch-ops activity.

## Merge recommendation

**MERGE** — focused comments smoke tests pass, no production runtime changed, and the comments lane is launch-candidate pending manual deployed-environment smoke evidence.
