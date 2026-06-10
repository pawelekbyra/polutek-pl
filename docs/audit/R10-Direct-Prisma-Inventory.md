# R10 Direct Prisma Inventory

This report lists all API routes in `app/api/**` that still import `@/lib/prisma` directly, instead of using domain modules.

## Inventory Map

| Route | Domain | Prisma Usage Count | Roadmap Stage | Reason |
|-------|--------|--------------------|---------------|--------|
| `app/api/user/referrals/claim/route.ts` | Referrals | 1 | R10 | Legacy referral logic |
| `app/api/subscriptions/route.ts` | Users/Patron | 6 | R7 | Mixed route, subscriptions direct Prisma |
| `app/api/videos/[id]/playback-event/route.ts` | Video/Analytics | 8 | R6/R3 | Persistence of events/views |
| `app/api/admin/videos/[id]/route.ts` | Video | 1 | R6 | Audit details extension |
| `app/api/admin/stats/route.ts` | Admin | 4 | R11 | Global dashboard stats |
| `app/api/admin/users/[userId]/route.ts` | Users | 5 | R5 | Extensions (payments, subs) |
| `app/api/admin/subscribers/resync/route.ts` | Users | 3 | R5 | Legacy subscriber sync |
| `app/api/media/[...path]/route.ts` | Media | 2 | R3 | Legacy media delivery check |

## Analysis (Reconciled After R9)

- **R9 Email & R8 Comments** are no longer direct Prisma blockers. All email routes, including template management, are now modular.
- **R7 Subscriptions**: `app/api/subscriptions/route.ts` remains a major direct Prisma user.
- **R5 Users/Referrals/Resync**: Legacy logic persists in admin user details, subscriber resync, and referral claims.
- **R6/R3 Video/Media/Playback**: Persistence of playback events and legacy media checks still bypass repositories.
- **R11 Admin Stats**: Global dashboard statistics are still calculated via direct Prisma queries.
- **R10 Dead Service Candidates**: While not all are direct Prisma routes, many legacy services (e.g., `referral.service.ts`) are the reason these routes still use direct Prisma.
