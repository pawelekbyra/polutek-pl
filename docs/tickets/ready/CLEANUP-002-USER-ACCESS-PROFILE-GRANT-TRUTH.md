# CLEANUP-002 — User access profile PatronGrant truth

Status: DONE_IN_THIS_PR
Type: runtime cleanup / access read-model hardening
Owner authorization: direct owner request in chat to create cleanup tickets and execute them safely turn by turn.

## Intent

Remove a remaining runtime read of legacy `User.isPatron` from the user access profile path. This path described itself as an access-decision read model, so it must not expose patron access from the legacy user cache.

## Scope

Allowed files:

- `lib/modules/users/application/get-user-access-profile.use-case.ts`
- `lib/modules/users/domain/payment-totals.ts`
- `tests/unit/modules/users/get-user-access-profile.test.ts`
- `tests/unit/modules/users.test.ts`
- `docs/tickets/ready/CLEANUP-002-USER-ACCESS-PROFILE-GRANT-TRUTH.md`
- `docs/tickets/ready/README.md`

## Invariants

- Backend patron access truth remains: active `PatronGrant`.
- `User.isPatron` remains a legacy/cache read model only.
- `Subscription` remains mailing/follow/newsletter consent only.
- No schema changes.
- No migrations.
- No package files.
- No payment or playback changes.

## Required behavior

- `getUserAccessProfile(...).isPatron` must be derived from existence of an active `PatronGrant`.
- Stale `User.isPatron: true` without an active grant must return `isPatron: false`.
- Stale `User.isPatron: false` with an active grant must return `isPatron: true`.
- Admin status remains derived from local DB role.

## Validation

Required validation:

- `npm test -- --run tests/unit/modules/users/get-user-access-profile.test.ts tests/unit/modules/users.test.ts`
- `npm run quality:architecture-boundaries`
- `npm run typecheck`

## What did not change

- Admin user list/export compatibility aliases are not removed in this ticket.
- Clerk metadata sync is not changed in this ticket.
- `User.isPatron` column is not removed in this ticket.

## Follow-ups

- CLEANUP-003 should remove or isolate top-level admin patron cache aliases.
- CLEANUP-004 should remove `/api/media-source` legacy compatibility fields after frontend/e2e migration.
- CLEANUP-005 should reconcile `VideoAsset` DTO fields that do not exist in Prisma schema.
