# Reconciliation Report: Comment Read Product Contract

**ID:** X4-FIX-001-COMMENT-READ-PRODUCT-CONTRACT
**Date:** 2025-05-15
**Status:** IMPLEMENTED

## Executive Summary

This ticket implemented the product contract allowing comments to be publicly readable on all published videos, including patron-only videos. Write and reaction access remains strictly restricted to authorized patrons and admins.

## Product Contract Implemented

- **Read Access:** Guests and non-patrons can now list comments for videos where `checkVideoAccess` returns `PATRON_REQUIRED` or `LOGIN_REQUIRED`.
- **Read Denial:** `NOT_FOUND` and `DELETED` reasons still correctly block comment reading to prevent leaking metadata of unpublished or removed content.
- **Write/React Protection:** Users without full video access have `viewer.canComment`, `viewer.canReact`, and `viewer.canReport` set to `false`.

## Access Behavior

| State | Before | After |
| :--- | :--- | :--- |
| **Guest on Patron Video** | Blocked (403 Forbidden) | **Allowed (Read-only)** |
| **Non-Patron on Patron Video** | Blocked (403 Forbidden) | **Allowed (Read-only)** |
| **Patron on Patron Video** | Allowed (Read-write) | Allowed (Read-write) |
| **Guest on Public Video** | Allowed (Read-only) | Allowed (Read-only) |

## Viewer Capability Behavior

For a non-patron user listing comments on a patron-only video:
- `canComment`: `false` (Correctly derived from `CommentPolicy.canCreateComment(actor, accessResult.data)`)
- `canReact`: `false` (Correctly derived from `CommentPolicy.canReactToComment(actor, accessResult.data)`)
- `canReport`: `false` (Correctly derived from `CommentPolicy.canReportComment(actor, accessResult.data)`)

## What Did Not Change

- `checkVideoAccess` logic remains untouched.
- `CommentPolicy` logic remains untouched.
- Moderation permissions (`canModerate`) remain restricted to admins and video owners.
- Write/Update/Delete endpoints were not modified and still enforce full access.

## Tests/Validation Results

- **Unit Tests:** `tests/unit/modules/comments/r8-access-inheritance.test.ts` updated with 4 new cases:
    - Guest can list on patron-only video (interaction blocked).
    - Non-patron can list on patron-only video (interaction blocked).
    - `NOT_FOUND` still blocks.
    - `DELETED` still blocks.
- **Regression Tests:** All 12 tests in `r8-access-inheritance.test.ts` and 8 tests in `patron-grant-write-access.test.ts` passed.
- **Architecture Check:** Passed.
- **Typecheck:** Passed.

## Remaining Risks

- **UI State:** While the API now returns comments, the UI (EmbeddedComments.tsx) still needs to be updated to handle the `PATRON_REQUIRED` state gracefully (Target of X4-FIX-002).

## Next Recommended Ticket

**X4-FIX-002-comment-write-error-and-empty-states:** Update UI to handle read-only states and provide appropriate login/patron CTAs.

## Merge Recommendation

**MERGE** - The logic is correct, safe, and covered by tests.
