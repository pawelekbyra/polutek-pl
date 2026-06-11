# X2-FIX-002 — Comment Write Access PatronGrant Truth Reconciliation

## Summary

X2-FIX-002 inspected and hardened the comment write/reaction access surface. No runtime code change was required because comment write and reaction use cases already delegate the patron-required decision to `checkVideoAccess`, and X2-FIX-001 made `checkVideoAccess` use active `PatronGrant` records through `getPatronStatus` instead of stale `User.isPatron`.

This ticket adds focused comment-module tests proving that stale `User.isPatron` values do not decide patron-only comment write/reaction access.

## Intent

Ensure backend comment write/reaction access relies on active `PatronGrant` truth and not on:

- stale `User.isPatron` as final truth;
- Clerk metadata;
- frontend state;
- subscription or email consent.

## Inspected paths

- `lib/modules/comments/application/create-video-comment.use-case.ts`
- `lib/modules/comments/application/toggle-comment-like.use-case.ts`
- `lib/modules/comments/application/toggle-video-like.use-case.ts`
- `lib/modules/comments/application/toggle-video-dislike.use-case.ts`
- `lib/modules/comments/application/report-comment.use-case.ts`
- `lib/modules/comments/application/update-comment.use-case.ts`
- `lib/modules/comments/application/delete-comment.use-case.ts`
- `lib/modules/comments/application/list-video-comments.use-case.ts`
- `lib/modules/comments/application/list-comment-replies.use-case.ts`
- `lib/modules/comments/application/get-comment-context.use-case.ts`
- `lib/modules/comments/domain/comment.policy.ts`
- comment API route adapters under `app/api/comments/**` and `app/api/videos/[id]/comments/route.ts`
- existing comment tests under `tests/unit/modules/comments/**`

## What changed

Added `tests/unit/modules/comments/patron-grant-write-access.test.ts` with coverage for:

- active `PatronGrant` permits comment creation even when `User.isPatron` is stale `false`;
- no active `PatronGrant` denies comment creation even when `User.isPatron` is stale `true`;
- active `PatronGrant` permits comment reaction even when `User.isPatron` is stale `false`;
- no active `PatronGrant` denies comment reaction even when `User.isPatron` is stale `true`;
- active `PatronGrant` permits video reaction even when `User.isPatron` is stale `false`;
- anonymous users cannot create comments before patron lookup;
- admin comment creation behavior remains unchanged and does not require patron lookup;
- public comment read behavior remains unchanged for anonymous viewers.

## What did not change

- No payment/refund lifecycle changes.
- No `PatronGrant` schema changes.
- No Prisma schema or migrations.
- No Clerk sync changes.
- No subscription/email behavior changes.
- No public comment read behavior changes.
- No admin cockpit changes.
- No removal of `User.isPatron`.
- No broad refactor.

## Evidence: comment write/reaction access is backed by PatronGrant truth

Runtime flow remains:

1. comment write/reaction use cases call `checkVideoAccess` for the target video;
2. `CommentPolicy` only consumes the returned `AccessDecisionDto.hasAccess` and does not inspect `User.isPatron`, Clerk metadata, frontend state, or subscription state;
3. after X2-FIX-001, patron-tier `checkVideoAccess` calls `getPatronStatus` and allows access only when `activeGrants.length > 0`;
4. the new tests mock `getPatronStatus` at the Patron module boundary and prove comment creation/reactions follow `activeGrants`, not stale `User.isPatron`.

## Validation

- `git diff --check` — PASS
- `npm run quality:architecture-boundaries` — PASS
- `npm run typecheck` — PASS
- `npm test -- --run tests/unit/modules/comments/patron-grant-write-access.test.ts` — PASS (8 tests)
- `npm test -- --run tests/unit/modules/comments/patron-grant-write-access.test.ts tests/unit/modules/comments` — PASS (7 files, 52 tests)
- `npm test -- --run` — FAIL, unrelated pre-existing architecture reconciliation assertions in `tests/unit/architecture/post-merge-state-reconciliation.test.ts` expect legacy README/architecture-guard status text that is absent from current main. This ticket is forbidden from editing `README.md` or `scripts/check-architecture.ts`, so no runtime/docs fix was made for that suite.

## Scope confirmation

Changed files are within the allowed ticket scope:

- `tests/unit/modules/comments/patron-grant-write-access.test.ts`
- `docs/reports/reconciliation/X2-FIX-002-COMMENT-WRITE-ACCESS-PATRONGRANT-TRUTH.md`

## Remaining risks

- Existing comment read behavior currently inherits `checkVideoAccess`; this ticket intentionally preserves that behavior rather than changing public read semantics.
- Existing legacy actor shapes and DTO author fields may still carry `isPatron` for display/compatibility, but the tested backend write/reaction decisions do not rely on them as access truth.

## Follow-ups

- X2-FIX-003 should continue the broader access-truth migration for the next identified legacy surface without mixing it into comment write access.
- A future dedicated comment-read ticket can reconcile the product rule that patron-only video comments are visible to everyone, if the owner wants that runtime behavior changed.

## Ticket status

`MERGE` — comment write/reaction access is backed by PatronGrant truth through `checkVideoAccess`, and focused tests now lock the behavior.
