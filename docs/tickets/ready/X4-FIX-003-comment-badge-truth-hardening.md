# Ticket: X4-FIX-003-comment-badge-truth-hardening

**Lane:** Comments
**Type:** FIX
**Goal:** Address `User.isPatron` stale risk in comment author badges.
**Parallel Safety:** SAFE (isolated to comments DTO/mapper)

## Context
`toPublicCommentAuthor` in `lib/comments-public-author.ts` uses `author.isPatron` which is a denormalized field in the `User` model. This might be stale.

## Requirements
- Review `lib/comments-public-author.ts` and `lib/modules/comments/domain/comment.dto.ts`.
- Decide if "PATRON" badge should remain stale for performance or if a more robust check is needed.
- At minimum, ensure DTO documentation or comments acknowledge the display-only nature of this badge.
- Ensure `viewerCanEdit` and other interactive flags in `mapCommentToDto` do NOT rely on stale metadata.

## Allowed Files
- `lib/comments-public-author.ts`
- `lib/modules/comments/domain/comment.dto.ts`

## Forbidden Files
- `prisma/schema.prisma`

## Validation
- `npm test tests/unit/modules/comments/comment-policy.test.ts`
