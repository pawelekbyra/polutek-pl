# Reconciliation Report: X4-FIX-003-COMMENT-BADGE-TRUTH-HARDENING

## Summary
Hardened the comment author badge logic to address the staleness risk of denormalized `User.isPatron` data. Explicitly documented the display-only nature of author badges and ensured that interactive permissions (`viewerCanEdit`, `viewerCanDelete`, etc.) are derived from the backend access truth (`hasVideoAccess`, which is PatronGrant-backed) and not from potentially stale author metadata.

## Badge Truth/Staleness Decision
- The visual `PATRON` badge remains based on the denormalized `author.isPatron` field for performance reasons.
- This is now explicitly documented as **DISPLAY ONLY** and potentially stale in `lib/comments-public-author.ts` and `lib/modules/comments/domain/comment.dto.ts`.
- The `CommentAuthorDto` interface was synchronized with the runtime mapping, removing direct access-related fields like `role` and `isPatron` in favor of a `badges` array.

## Permission-Safety Evidence
- Interactive permissions in `mapCommentToDto` (edit, delete, report, moderate, pin) rely solely on the `hasVideoAccess` boolean passed from the application layer and the viewer's `userId`.
- These permissions do **not** rely on `author.isPatron` or other cache-only patron fields from the author's metadata.

## Tests Added/Updated
- Created `tests/unit/modules/comments/comment-badge-safety.test.ts`:
    - Proves the `PATRON` badge appears based on metadata (display-only).
    - Proves that stale `isPatron: true` in author profile does **not** grant interactive permissions if `hasVideoAccess` is false.
    - Proves permissions are correctly granted when `hasVideoAccess` is true, regardless of author metadata.

## What Did Not Change
- No changes to `prisma/schema.prisma` or migrations.
- No changes to `checkVideoAccess` or PatronGrant backend logic.
- Comment read/write product contracts remain the same.

## Validation Results
- `npm run typecheck`: Passed
- `npm run quality:architecture-boundaries`: Passed
- `npm test -- --run tests/unit/modules/comments/comment-badge-safety.test.ts`: Passed

## Remaining Risks
- Visual badges may still be stale until user re-sync occurs. This is accepted as a display-only risk.

## Next Recommended Ticket
X5 series or remaining comment refinements.

## Merge Recommendation
MERGE
