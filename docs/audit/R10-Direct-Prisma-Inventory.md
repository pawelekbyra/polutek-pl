# R10 Direct Prisma Inventory

This report lists all API routes in `app/api/**` that still import `@/lib/prisma` directly, instead of using domain modules.

## Inventory Map

| Route | Domain | Prisma Usage Count | Roadmap Stage | Reason |
|-------|--------|--------------------|---------------|--------|
| `app/api/admin/videos/[id]/route.ts` | Video | 1 | R6 | Audit details extension |
| `app/api/admin/users/[userId]/route.ts` | Users | 1 | R5 | Extensions (payments, subs) |
| `app/api/media/[...path]/route.ts` | Media | 1 | R3 | Legacy media delivery check |

## Analysis (Reconciled After Admin Subscribers Resync / Referrals)

- **PR #795 & #797 Merged**: `app/api/admin/stats/route.ts` and `app/api/subscriptions/route.ts` are now fully modularized and removed from this inventory.
- **R9 Email & R8 Comments** are no longer direct Prisma blockers. All email routes, including template management, are now modular.
- **R5 Users/Referrals/Resync**: Admin user details remain a blocker. Subscriber resync and referral claims are now modular and removed from this inventory. `app/api/user/referrals/route.ts` is clean.
- **R6/R3 Video/Media/Playback**: Persistence of playback events and legacy media checks still bypass repositories in some routes.
- **R11 Admin Stats**: Global dashboard statistics are now modular.
- **R10 Dead Service Candidates**: While not all are direct Prisma routes, many legacy services (e.g., `referral.service.ts`) are the reason these routes still use direct Prisma. `referral.service.ts` is now removed.
