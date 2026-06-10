# R10 Direct Prisma Inventory

This report lists all API routes in `app/api/**` that still import `@/lib/prisma` directly, instead of using domain modules.

## Inventory Map

| Route | Domain | Prisma Usage Count | Roadmap Stage | Reason |
|-------|--------|--------------------|---------------|--------|

## Analysis (Reconciled After R10 Direct-Prisma Cleanup)

- **R10 Complete**: All API routes in `app/api/**` have been modularized and no longer import `@/lib/prisma` directly.
- **PR #795 & #797 Merged**: `app/api/admin/stats/route.ts` and `app/api/subscriptions/route.ts` are modularized.
- **R9 Email & R8 Comments**: All email routes and core comments routes are modular.
- **R5 Users**: Admin user details and webhook sync are modular.
- **R6/R3 Video/Media**: Media delivery and playback events are now handled via domain modules.
- **R11 Admin Stats**: Global dashboard statistics are now modular.
- **R10 Dead Service Candidates**: While not all are direct Prisma routes, many legacy services (e.g., `referral.service.ts`) are the reason these routes still use direct Prisma. `referral.service.ts` is now removed.
