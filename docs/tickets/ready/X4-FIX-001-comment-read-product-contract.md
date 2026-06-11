# Ticket: X4-FIX-001-comment-read-product-contract

**Lane:** Comments
**Type:** FIX
**Goal:** Allow public read access to comments on all published videos, including patron-only ones.
**Parallel Safety:** SAFE (isolated to `listVideoComments` use-case)

## Context
Currently, `listVideoComments` fails with `FORBIDDEN` if `checkVideoAccess` returns `hasAccess: false`. Per product contract, comments should be readable by everyone.

## Requirements
- Modify `lib/modules/comments/application/list-video-comments.use-case.ts`.
- Allow execution to continue if `accessResult.data.reason === 'PATRON_REQUIRED'`.
- Ensure `viewer.canComment`, `canReact`, etc., correctly reflect that the user cannot write if they don't have full video access.
- Ensure `NOT_FOUND` and `DELETED` reasons still block comment reading.

## Allowed Files
- `lib/modules/comments/application/list-video-comments.use-case.ts`

## Forbidden Files
- Any UI files.
- Any other modules.

## Validation
- `npm test tests/unit/modules/comments/r8-access-inheritance.test.ts` (needs updating or new test).
- Manual verification via API call as a guest on a patron-only video.
