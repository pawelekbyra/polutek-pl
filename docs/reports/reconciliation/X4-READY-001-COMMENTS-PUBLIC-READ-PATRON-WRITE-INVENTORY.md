# Reconciliation Report: Comments Public-Read / Patron-Write Readiness Inventory

**ID:** X4-READY-001-COMMENTS-PUBLIC-READ-PATRON-WRITE-INVENTORY
**Date:** 2025-05-15
**Status:** READY FOR X4 EXECUTION

## Executive Summary

This report assesses the readiness of the comments module for the X4 phase: Public-Read / Patron-Write. Currently, the system enforces Patron-only read access for comments on Patron-only videos, which conflicts with the target product goal (publicly visible comments). Write access (creating, reacting, reporting) is already correctly backed by `PatronGrant` truth via the `Access` module. UI needs alignment to handle public-read states and to avoid relying on potentially stale metadata for badge display.

## Current Verdict

**LEGACY** (with SAFE foundations)

*   **SAFE:** Write access logic is already migrated to `checkVideoAccess` and `PatronGrant` truth.
*   **LEGACY:** `listVideoComments` still enforces video-access-inheritance for reading, which blocks public read for patron-only videos.
*   **UNKNOWN:** UX state for logged-out users on patron-only videos might need refinement in the `CommentComposer`.

## Product Contract (Current vs. Target)

| Action | Current Code Behavior | Target Product Contract | Status |
| :--- | :--- | :--- | :--- |
| **Read Comments (Public Video)** | Everyone | Everyone | ✅ MATCH |
| **Read Comments (Patron Video)** | Patrons/Admins only | **Everyone** | ❌ GAP |
| **Write Comment** | Patrons/Admins only | Patrons/Admins only | ✅ MATCH |
| **React to Comment** | Patrons/Admins only | Patrons/Admins only | ✅ MATCH |
| **Report Comment** | Patrons/Admins only | Patrons/Admins only | ✅ MATCH |
| **Moderate Comment** | Admin/Creator only | Admin/Creator only | ✅ MATCH |
| **Logged-out View** | See comments (Public) / Blocked (Patron) | See comments (All) / Read-only | ❌ GAP |
| **Non-Patron View** | See comments (Public) / Blocked (Patron) | See comments (All) / Read-only | ❌ GAP |

## Product Contract Gaps & Owner Decisions Needed

1.  **Read Permission Alignment:** `listVideoComments` must be updated to allow reading even if `checkVideoAccess` returns `hasAccess: false` with reason `PATRON_REQUIRED`.
2.  **Stale Badge Truth:** Author "PATRON" badge currently uses `User.isPatron` field which is target-deprecated. Decision: Is it acceptable for display-only badges to be slightly stale, or should we use `PatronGrant` check for comment authors too (performance concern)?

## File/Path Inventory

### Domain/Application
*   `lib/modules/comments/domain/comment.policy.ts`: Write/React/Report rules.
*   `lib/modules/comments/domain/comment.dto.ts`: Mapper for public/admin DTOs.
*   `lib/modules/comments/application/list-video-comments.use-case.ts`: **Main logic for comment reading (GAP HERE).**
*   `lib/modules/comments/application/create-video-comment.use-case.ts`: Comment creation.
*   `lib/modules/comments/application/toggle-comment-like.use-case.ts`: Reaction logic.
*   `lib/modules/comments/application/report-comment.use-case.ts`: Reporting logic.

### API Routes
*   `app/api/videos/[id]/comments/route.ts`: Public GET/POST.
*   `app/api/comments/[commentId]/reaction/route.ts`: Reaction PUT/DELETE.
*   `app/api/comments/[commentId]/report/route.ts`: Report POST.
*   `app/api/admin/comments/**`: Moderation routes.

### UI Components
*   `app/components/comments/EmbeddedComments.tsx`: Main container.
*   `app/components/comments/components/CommentComposer.tsx`: Input area.
*   `app/components/comments/components/CommentItem.tsx`: Single comment view.

## Access-Truth Map

*   **Read Comments:** `checkVideoAccess` -> if `hasAccess` or `reason === 'PATRON_REQUIRED'` (Target)
*   **Write Comments:** `CommentPolicy.canCreateComment` -> `checkVideoAccess.hasAccess` (PatronGrant truth)
*   **Edit/Delete Own:** `CommentPolicy.canUpdateComment` -> Author check + `hasVideoAccess`.
*   **React:** `CommentPolicy.canReactToComment` -> `checkVideoAccess.hasAccess`.
*   **Admin Moderate:** `CommentPolicy.canModerateComment` -> Admin actor or Video Creator.

## Evidence of PatronGrant-backed Access

*   `tests/unit/modules/comments/patron-grant-write-access.test.ts` verifies that `createVideoComment` and `toggleCommentLike` correctly respect `getPatronStatus` result over `User.isPatron` field.

## UX Inventory

*   **Logged-out:** Currently sees "Komentarze pod tym filmem są dostępne tylko dla Patronów" on patron videos. Should see comments + "Log in to join conversation".
*   **Non-Patron:** Currently sees "Komentarze pod tym filmem są dostępne tylko dla Patronów". Should see comments + "Become a Patron to comment".
*   **Patron:** Sees comments + active composer.
*   **Admin:** Sees comments + active composer + moderation tools.

## Security/Moderation Risks

*   **Spoiler Leak:** If comments are public on patron videos, non-patrons might see spoilers in comments. `SPAM`/`SPOILER` reporting reason is critical.
*   **Rate Limiting:** Already implemented in API routes for comments and reports.

## Test Coverage Inventory

*   **High:** Write/React access for Patrons vs Non-Patrons.
*   **Low:** Guest-read behavior on Patron-only videos (currently blocked, needs positive tests once opened).
*   **Low:** Edge cases of `User.isPatron` mismatches in UI display.

## Launch Blockers

*   **None** (from a technical standpoint), but Product requirement "Comments readable by everyone" is currently not met by code.

## Recommended Next Tickets

1.  **X4-FIX-001-comment-read-product-contract:** Allow reading comments on all published videos regardless of tier.
2.  **X4-FIX-002-comment-write-error-and-empty-states:** Update UI to correctly prompt for login/patronage when write is denied.
3.  **X4-FIX-003-comment-badge-truth-hardening:** Address `User.isPatron` usage in `publicCommentAuthorSelect`.
4.  **X4-FIX-004-comment-access-truth-negative-tests:** Add specific test cases for unauthorized write attempts on public-read comments.

## Validation Performed

*   Code review of `lib/modules/comments/**`.
*   Code review of `app/api/videos/[id]/comments/route.ts`.
*   Review of `tests/unit/modules/comments/patron-grant-write-access.test.ts`.
*   Verified `AGENTS.md` invariants.

## Merge Recommendation

**MERGE** (This is a documentation-only readiness report).
