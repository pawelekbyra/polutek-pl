# CLEANUP-001 — Schema truth-language cleanup

Status: DONE_IN_THIS_PR
Type: docs/schema-comment cleanup
Owner authorization: direct owner request in chat to create cleanup tickets and execute them safely turn by turn.

## Intent

Remove misleading legacy language from Prisma schema comments where old patron/access terminology can be read as current source of truth.

## Scope

Allowed files:

- `prisma/schema.prisma`
- `docs/tickets/ready/CLEANUP-001-SCHEMA-TRUTH-LANGUAGE.md`
- `docs/tickets/ready/README.md`

## Invariants

- Backend patron access truth remains: active `PatronGrant`.
- `Subscription` remains mailing/follow/newsletter consent only.
- `User.isPatron`, `User.patronSince`, and `User.patronSource` remain legacy/cache/read-model fields only.
- No runtime behavior changes.
- No Prisma model/field/database shape changes.
- No migration is added.

## Validation

Required validation:

- `npm run db:validate`
- `npm run quality:architecture-boundaries`

## What did not change

- No access logic.
- No payment logic.
- No playback logic.
- No admin UI/API contract.
- No migrations.
- No package files.

## Follow-ups

- CLEANUP-002 should remove or isolate top-level admin patron cache aliases.
- CLEANUP-003 should remove `/api/media-source` legacy compatibility fields after frontend migration.
- CLEANUP-004 should reconcile `VideoAsset` DTO fields that do not exist in Prisma schema.
