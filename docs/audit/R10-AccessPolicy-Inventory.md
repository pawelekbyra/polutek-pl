# R10 AccessPolicy Inventory

This report identifies all runtime usages of the legacy `lib/access/access-policy.ts` and their migration status.

## Usage Inventory

| File | Domain | Status | Reason |
|------|--------|--------|--------|
| `lib/services/content/video.service.ts` | Video | **FUTURE CLEANUP** | Legacy service dependency. Service itself is deprecated. |
| `lib/services/comments/comment.service.ts` | Comments | **BLOCKED BY R8** | Legacy comments service depends on legacy policy. |
| `lib/services/comments/comment-access.service.ts` | Comments | **BLOCKED BY R8** | Core comment access logic still uses legacy policy. |
| `lib/actions/interactions.ts` | Interactions | **BLOCKED BY R8**? | Server actions for reactions use legacy policy. |

## Migration Status

- **Comments & Interactions**: Currently the main blockers for removing `AccessPolicy`. Migration to `lib/modules/access` should happen as part of R8 (Comments/Interactions).
- **Video & Playback**: `lib/services/playback/playback.service.ts` has already migrated to `checkVideoAccess` from `@/lib/modules/access`.
- **Admin**: Some checks for admin management in `comment-access.service.ts` still use `AccessPolicy.canManageAdmin`. These should be moved to a more robust RBAC or modular check.

## Classification Guide

- **CAN MIGRATE NOW**: No hard blockers, can be moved to `lib/modules/access`.
- **BLOCKED BY R7/R8**: Depends on ongoing work in Payments (R7) or Comments (R8).
- **FUTURE CLEANUP**: Technical debt to be addressed after major roadmap stages.
