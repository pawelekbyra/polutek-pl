# Ticket: X4-FIX-004-comment-access-truth-negative-tests

**Lane:** Comments
**Type:** TEST
**Goal:** Add negative tests for guest/non-patron write/react attempts on public-read comments.
**Parallel Safety:** SAFE (test-only)

## Context
We need to ensure that even though comments are publicly readable, write access remains strictly gated by `PatronGrant` truth.

## Requirements
- Add tests to `tests/unit/modules/comments/patron-grant-write-access.test.ts`.
- Verify `createVideoComment` fails for guests even if video is public.
- Verify `toggleCommentLike` fails for guests.
- Verify `createVideoComment` fails for non-patron users on patron-only videos even if they can read the comments.

## Allowed Files
- `tests/unit/modules/comments/patron-grant-write-access.test.ts`

## Forbidden Files
- `lib/modules/**`
- `app/**`

## Validation
- `npm test tests/unit/modules/comments/patron-grant-write-access.test.ts`
