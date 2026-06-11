# Ticket: X4-FIX-002-comment-write-error-and-empty-states

**Lane:** Comments
**Type:** FIX
**Goal:** Improve UI feedback for non-patrons and guests on the comment section.
**Parallel Safety:** SAFE (isolated to Comments UI)

## Context
With public read enabled, guests and non-patrons will see comments but need clear call-to-actions (CTA) instead of just a hidden or disabled composer.

## Requirements
- Update `app/components/comments/EmbeddedComments.tsx` and `CommentComposer.tsx`.
- Show "Log in to comment" for guests.
- Show "Become a Patron to comment" for logged-in non-patrons on patron-only videos.
- Ensure error messages from failed POST/PUT/DELETE requests are user-friendly and localized.

## Allowed Files
- `app/components/comments/**`

## Forbidden Files
- `lib/modules/**`
- `app/api/**`

## Validation
- Visual verification of the comment section in different auth/patron states.
