# R10 Direct Prisma Inventory

This report lists all API routes in `app/api/**` that still import `@/lib/prisma` directly, instead of using domain modules.

## Inventory Map

| Route | Domain | Prisma Usage Count | Roadmap Stage | Reason |
|-------|--------|--------------------|---------------|--------|
| `app/api/user/referrals/claim/route.ts` | Referrals | 1 | R10 | Legacy referral logic |
| `app/api/subscriptions/route.ts` | Users/Patron | 6 | R7 | Mixed route, subscriptions direct Prisma |
| `app/api/videos/[id]/playback-event/route.ts` | Video/Analytics | 8 | R6/R3 | Persistence of events/views |
| `app/api/videos/[id]/comments/route.ts` | Comments | 6 | R8 | Comments list still legacy |
| `app/api/admin/payment-settings/route.ts` | Payments | 2 | R7 | Admin payment settings |
| `app/api/admin/templates/route.ts` | Email | 5 | R9 | Legacy email templates |
| `app/api/admin/videos/[id]/comments/route.ts` | Comments | 0 (unused import) | R8 | Mixed admin route |
| `app/api/admin/videos/[id]/route.ts` | Video | 1 | R6 | Audit details extension |
| `app/api/admin/stats/route.ts` | Admin | 4 | R11 | Global dashboard stats |
| `app/api/admin/comments/route.ts` | Comments | 1 | R8 | Admin comments management |
| `app/api/admin/users/export/route.ts` | Users | 1 | R5 | Admin user export still legacy |
| `app/api/admin/users/[userId]/route.ts` | Users | 5 | R5 | Extensions (payments, subs) |
| `app/api/admin/subscribers/resync/route.ts` | Users | 3 | R5 | Legacy subscriber sync |
| `app/api/admin/emails/responses/route.ts` | Email | 2 | R9 | Email response tracking |
| `app/api/comments/[commentId]/pin/route.ts` | Comments | 2 | R8 | Comment pinning |
| `app/api/comments/[commentId]/route.ts` | Comments | 3 | R8 | Comment CRUD |
| `app/api/comments/[commentId]/context/route.ts` | Comments | 2 | R8 | Comment context/thread |
| `app/api/comments/[commentId]/replies/route.ts` | Comments | 3 | R8 | Comment replies |
| `app/api/media/[...path]/route.ts` | Media | 2 | R3 | Legacy media delivery check |

## Analysis

- **Comments (R8)** is the largest remaining user of direct Prisma in the API. Most comment actions bypass the (not yet fully implemented) comment module.
- **Payments (R7)** still has critical paths (subscriptions, settings) using direct Prisma.
- **Users (R5)** is mostly done, but admin extensions (export, resync) remain legacy.
- **Video (R6)** and **Media (R3)** have some remaining "certified" mixed routes that use Prisma for specific persistence tasks not yet moved to repositories.
