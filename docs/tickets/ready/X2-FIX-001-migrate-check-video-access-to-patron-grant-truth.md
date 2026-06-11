# Ticket: X2-FIX-001 Migrate `checkVideoAccess` to PatronGrant Ground Truth

## ID
X2-FIX-001

## Lane
LANE-access

## Type
FIX

## Goal
Update `checkVideoAccess` use case to use active `PatronGrant` as the backend source of truth for patron access, rather than the `User.isPatron` boolean field.

## Parallel Safety
SAFE (only modifies access decision logic)

## Context
- X2-READY-001 inventory identified that `checkVideoAccess` still relies on `User.isPatron`.
- Ground truth for access must be the existence of at least one active (unrevoked) `PatronGrant`.

## Required
1. Update `checkVideoAccess` in `lib/modules/access/application/check-video-access.use-case.ts`.
2. Instead of checking `user.isPatron`, it must check for active grants.
3. It is recommended to use `PatronRepository.listActiveGrants(userId)` or `findFirstActiveGrant(userId)`.
4. Ensure the change remains within the existing module boundaries (importing from `@/lib/modules/patron` index).
5. Update or add unit tests to verify access is granted based on grants, even if `User.isPatron` was manually set to false (though they should stay in sync).

## Allowed Files
- `lib/modules/access/application/check-video-access.use-case.ts`
- `tests/unit/modules/access/check-video-access.use-case.test.ts`

## Forbidden Files
- `prisma/schema.prisma`
- `lib/modules/patron/**` (internal repository should not be imported directly by access, use public API)
- `app/**`

## Validation
- `npm run quality:architecture-boundaries`
- `npm run typecheck`
- `npm test tests/unit/modules/access/check-video-access.use-case.test.ts`
