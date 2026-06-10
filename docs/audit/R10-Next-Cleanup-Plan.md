# R10 Next Cleanup Plan

This document outlines the safe cleanup order for R10 work, targeting the removal of direct Prisma imports and legacy services after their respective domains are fully modularized and certified.

## Safe Cleanup Order

### 1. R8 Comments Admin Leftovers
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

### 2. Dead Code Removal (Safe Now)
- **Task**: Remove services with no runtime usage.
- **Candidates**:
    - `lib/services/user.service.ts`
    - `lib/services/content.visibility.ts`
    - `lib/services/patron.service.ts`
    - `lib/services/comments/comment-audit.service.ts`

### 3. R9 Email Finalization
- **Task**: Migrate email templates and broadcast logic to modular repositories.
- **Affected Routes**:
    - `app/api/admin/templates/route.ts`
- **Legacy Services to Remove**:
    - `lib/services/email.service.ts` (after BRIDGE is no longer needed)

### 4. R7 Payments/Patron Subscriptions
- **Task**: Migrate subscription management to `lib/modules/payments`.
- **Affected Routes**:
    - `app/api/subscriptions/route.ts`
- **Legacy Services to Remove**:
    - `lib/services/payment.service.ts`

### 5. Media/Video (R3/R6) Mixed Routes
- **Task**: Move remaining persistence logic (playback events, diagnostics) to repositories.
- **Affected Routes**:
    - `app/api/videos/[id]/playback-event/route.ts`
    - `app/api/admin/videos/[id]/route.ts`
    - `app/api/media/[...path]/route.ts`

### 6. R11 Admin Dashboard
- **Task**: Modularize global stats.
- **Affected Routes**:
    - `app/api/admin/stats/route.ts`

## Verification Strategy
- For each step, run `npx ts-node scripts/check-architecture.ts`.
- Ensure all unit tests pass, especially those in `tests/unit/modules/`.
- Verify that the `PRISMA_ROUTES_ALLOWLIST` in `scripts/check-architecture.ts` can be reduced.
