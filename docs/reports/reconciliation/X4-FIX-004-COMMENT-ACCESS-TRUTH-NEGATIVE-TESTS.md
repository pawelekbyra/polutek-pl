# X4-FIX-004 — Comment Access Truth Negative Tests

## Summary

Added negative unit coverage for comment access truth on public-read comments. The tests prove that comment visibility for guest/non-patron viewers does not grant mutation permissions for comment creation or comment reactions.

## Intent

Protect the product invariant that published video comments can remain publicly readable while interactive comment actions continue to require the same backend video access truth used by `checkVideoAccess` / active `PatronGrant` logic.

## Changed files

- `tests/unit/modules/comments/patron-grant-write-access.test.ts`
- `docs/reports/reconciliation/X4-FIX-004-COMMENT-ACCESS-TRUTH-NEGATIVE-TESTS.md`

## Negative cases covered

- Guest can read comments on a patron-only published video, but cannot `createVideoComment`.
- Guest can read comments on a patron-only published video, but cannot `toggleCommentLike`.
- Logged-in non-patron can read comments on a patron-only published video, but cannot `createVideoComment`.
- Stale viewer `User.isPatron: true` does not grant comment creation or reaction permission without active `PatronGrant` access.
- Visible comment author `PATRON` badge display state remains display-only and does not grant viewer write/react permissions.
- Public comment read behavior for anonymous viewers remains unchanged.

## Scope confirmation

This PR is test-only. Production code was not changed.

No changes were made to forbidden runtime paths, Prisma schema/migrations, package files, roadmap files, strategy files, README, AGENTS, or architecture guards.

## What did not change

- No production comment policy or access code was changed.
- No video, playback, media-source, Cloudflare, admin video, package, Prisma, README, roadmap, or strategy files were changed.
- No dependencies were added or updated.

## Validation results

- `git diff --check` — PASS
- `npm test tests/unit/modules/comments/patron-grant-write-access.test.ts` — PASS, 11 tests passed
- `npm run typecheck` — FAIL/BLOCKED by pre-existing video-provider Prisma client/schema mismatch outside this test-only ticket scope. Errors reference `lib/modules/video/**` and `tests/unit/modules/video/**` Cloudflare `VideoAssetProcessingState` / `CLOUDFLARE_STREAM` / asset-field types.
- `npm run quality:architecture-boundaries` — PASS

## Bugs discovered

No comment access production bug was discovered by this ticket. The new negative tests pass without production-code changes.

The repository currently has unrelated typecheck failures in video-provider code that are outside this ticket's allowed paths and overlap the parallel X3 Cloudflare workstream.

## Risks

- Full repository typecheck remains blocked until the video-provider Prisma/schema mismatch is reconciled by the relevant video/Cloudflare ticket.
- This PR intentionally does not patch runtime behavior if future expanded tests expose production bugs.

## Follow-ups

- Resolve the existing Cloudflare/video asset typecheck failures in the X3 video-provider workstream.
- Next recommended ticket: continue with the planned X4 comment-access/UI certification follow-up after the video typecheck blocker is cleared.

## Ticket status

Implemented within the allowed test/report scope.

## Merge recommendation

MERGE — comment access negative tests pass and production code was not changed. The only failed validation is an unrelated pre-existing typecheck blocker in forbidden video-provider paths.
