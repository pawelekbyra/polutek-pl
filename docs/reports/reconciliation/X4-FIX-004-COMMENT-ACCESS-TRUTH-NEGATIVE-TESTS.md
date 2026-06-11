# X4-FIX-004 — Comment Access Truth Negative Tests

## Summary
Added focused unit coverage proving that public-read comment visibility does not grant comment creation or reaction permissions to guests, logged-in non-patrons, or users with stale patron display metadata but no active `PatronGrant`.

## Intent
Lock the comments access invariant after X4-FIX-001/X4-FIX-002/X4-FIX-003:

- Published patron-only video comments may remain publicly readable.
- Interactive comment mutations still require backend access truth.
- `User.isPatron` and displayed author badges are presentation/cache state only and must not authorize writes or reactions.

## Changed files
- `tests/unit/modules/comments/patron-grant-write-access.test.ts`
- `docs/reports/reconciliation/X4-FIX-004-COMMENT-ACCESS-TRUTH-NEGATIVE-TESTS.md`

## Negative cases covered
- Guest can read public comments on a patron-only video but cannot call `createVideoComment`.
- Guest can read public comments on a patron-only video but cannot call `toggleCommentLike`.
- Logged-in non-patron can read public comments on a patron-only video but cannot call `createVideoComment`.
- A stale `User.isPatron: true` viewer and displayed `PATRON` author badge do not grant edit/delete/report display permissions, comment creation, or comment reaction when active grants are absent.
- Read behavior remains intact while mutation behavior is blocked.

## Production code confirmation
No production code was changed. This PR is test/report only.

## Validation results
- `git diff --check` — PASS
- `npm test tests/unit/modules/comments/patron-grant-write-access.test.ts` — PASS
- `npm run typecheck` — FAIL (pre-existing/unrelated Cloudflare `VideoAsset` Prisma client/schema mismatch in forbidden `lib/modules/video/**` and related video tests; not introduced or modified by this test-only ticket)
- `npm run quality:architecture-boundaries` — PASS

## Bugs discovered
No comment-access production bug was discovered. The added negative tests passed against the current implementation.

Validation surfaced an unrelated repository typecheck failure in Cloudflare/video asset code paths (`VideoAssetProcessingState`, `StorageProvider.CLOUDFLARE_STREAM`, and `VideoAsset` provider/processing fields). Those paths are explicitly forbidden for this ticket and overlap the parallel X3-FIX-008 workstream.

## Risks
Low. The runtime code path was not modified, and the test changes are scoped to existing comment access unit coverage.

## Follow-ups
Recommended next ticket: continue with the independent X3-FIX-008 Cloudflare import/attach legacy-video work, preserving the declared parallel-work separation.

## Ticket status
X4-FIX-004 is complete.

## Merge recommendation
MERGE
