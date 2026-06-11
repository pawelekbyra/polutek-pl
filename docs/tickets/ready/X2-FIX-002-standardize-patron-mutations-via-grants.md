# Ticket: X2-FIX-002 Standardize Patron Mutations via Grants

## ID
X2-FIX-002

## Lane
LANE-payments-patron

## Type
FIX

## Goal
Ensure all paths that modify patron status go through the modular `grantPatron` or `revokePatron` use cases, which manage both the ground truth (`PatronGrant`) and the denormalized cache (`User.isPatron`).

## Parallel Safety
SAFE (Audit and cleanup of mutation paths)

## Context
- `User.isPatron` should be treated as a read-cache.
- Mutations must be backed by a grant record for audit and consistency.

## Required
1. Audit all remaining manual writes to `User.isPatron` in the codebase.
2. Replace them with calls to `grantPatron` or `revokePatron` from `@/lib/modules/patron`.
3. Pay special attention to:
   - User sync from Clerk (if any logic there touches isPatron).
   - Admin routes (should already be using modular use cases after R10).
   - Migration or legacy cleanup scripts.
4. Verify that `UserAccessService.recalculateUserPatronStatus` is used only where batch resync is needed, and it correctly uses the new logic from X1-FIX-005.

## Allowed Files
- `app/api/**` (only if fixing direct Prisma writes to user.isPatron)
- `lib/services/**` (only if fixing direct Prisma writes to user.isPatron)
- `lib/modules/users/**`
- `lib/modules/patron/**`

## Forbidden Files
- `prisma/schema.prisma`
- `lib/modules/access/**`

## Validation
- `npm run quality:architecture-boundaries`
- `npm test`
