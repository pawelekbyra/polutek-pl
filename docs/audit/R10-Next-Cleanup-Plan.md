# R10 Next Cleanup Plan

This document outlines the safe cleanup order for R10 work, targeting the removal of direct Prisma imports and legacy services after their respective domains are fully modularized and certified.

## Safe Cleanup Order

### 1. Admin Subscribers Resync or Referrals
- **Task**: Migrate legacy subscriber sync and referral logic to modular use cases.
- **Affected Routes**:
    - `app/api/admin/subscribers/resync/route.ts`
    - `app/api/user/referrals/claim/route.ts`
- **Legacy Services to Remove**:
    - `lib/services/referral.service.ts`

### 2. Playback-event route (R6/R3)
- **Task**: Move remaining persistence logic (playback events) to repositories.
- **Affected Routes**:
    - `app/api/videos/[id]/playback-event/route.ts`

### 3. Admin Videos [id] (R6)
- **Task**: Modularize audit details extension and remove direct Prisma.
- **Affected Routes**:
    - `app/api/admin/videos/[id]/route.ts`

### 4. Media/[...path] (R3)
- **Task**: Replace legacy media delivery checks with modular access/media logic.
- **Affected Routes**:
    - `app/api/media/[...path]/route.ts`

### 5. R8 Comments Admin Leftovers
- **Task**: Migrate admin moderation routes to modular use cases.
- **Affected Routes**:
    - `app/api/admin/comments/reports/route.ts`
    - `app/api/admin/comments/[commentId]/heart/route.ts`
    - `app/api/admin/comments/[commentId]/hide/route.ts`
    - `app/api/admin/comments/[commentId]/delete/route.ts`
    - `app/api/admin/comments/[commentId]/restore/route.ts`
- **Legacy Services to Remove**:
    - `lib/services/comments/comment.service.ts`
    - `lib/services/comments/comment-report.service.ts`
    - `lib/services/comments/comment-moderation.service.ts`

### 6. R10 Dead Code Removal (Safe Now)
- **Task**: Remove services with no runtime usage found in the inventory.
- **Candidates**:
    - `lib/services/user.service.ts`
    - `lib/services/patron.service.ts`
    - `lib/services/content.visibility.ts`
    - `lib/services/user/admin.service.ts`
    - `lib/services/user/subscription.service.ts`
    - `lib/services/payments/refund.service.ts`
    - `lib/services/admin/payments-admin.service.ts`
    - `lib/services/comments/comment-reaction.service.ts`
    - `lib/services/comments/comment-audit.service.ts`
    - `lib/services/comments/comment-access.service.ts`

## Verification Strategy
- For each step, run `npm run quality:architecture-boundaries`.
- Ensure all unit tests pass, especially those in `tests/unit/modules/`.
- Verify that the `PRISMA_ROUTES_ALLOWLIST` in `scripts/check-architecture.ts` can be reduced.
