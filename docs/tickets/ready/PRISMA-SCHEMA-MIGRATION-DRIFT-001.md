# PRISMA-SCHEMA-MIGRATION-DRIFT-001 — `schema.prisma` has diverged from the applied migration history

Status: READY_FOR_BUILDER
Priority: HIGH (one drifted column already has informal, undocumented
null-handling in application code — this is not theoretical)

## Why

While building `AUDIT-LOG-INDEX-001`'s migration (2026-09-20), applying the
**full existing migration history** (`prisma migrate deploy`, all 37
migration folders, in order, on a clean throwaway Postgres 16 instance) and
then diffing the resulting database against the current `prisma/schema.prisma`
(`prisma migrate diff --from-url <fully-migrated-db> --to-schema-datamodel
prisma/schema.prisma --script`) revealed real, pre-existing drift —
completely unrelated to the AuditLog index change, confirmed by reproducing
it from a clean DB before adding anything of my own:

```sql
-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";
-- DropForeignKey
ALTER TABLE "NotificationPreference" DROP CONSTRAINT "NotificationPreference_userId_fkey";

-- DropIndex
DROP INDEX "VideoPlaybackSession_createdAt_idx";

-- AlterTable
ALTER TABLE "BroadcastEmail" ALTER COLUMN "sentAt" DROP NOT NULL,
ALTER COLUMN "sentAt" DROP DEFAULT,
ALTER COLUMN "recipientCount" SET DEFAULT 0,
ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "EmailEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "VideoOriginal" ALTER COLUMN "updatedAt" DROP DEFAULT;
-- AlterTable
ALTER TABLE "VideoPlaybackSession" ALTER COLUMN "sourceKind" DROP NOT NULL,
ALTER COLUMN "maxProgressMs" SET NOT NULL,
ALTER COLUMN "maxProgressMs" SET DEFAULT 0,
ALTER COLUMN "lastHeartbeatAt" DROP NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex (7 missing indexes)
CREATE INDEX "Comment_videoId_createdAt_idx" ON "Comment"("videoId", "createdAt");
CREATE INDEX "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt");
CREATE INDEX "PatronGrant_userId_revokedAt_idx" ON "PatronGrant"("userId", "revokedAt");
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");
CREATE INDEX "Video_status_publishedAt_idx" ON "Video"("status", "publishedAt");
CREATE INDEX "Video_status_createdAt_idx" ON "Video"("status", "createdAt");
CREATE INDEX "Video_creatorId_status_idx" ON "Video"("creatorId", "status");

-- AddForeignKey (re-adds the same two FKs dropped above)
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" ...
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" ...
```

In plain terms: `schema.prisma` declares several indexes, nullability
changes and a default that **no migration file ever created**. Either these
were hand-edited into `schema.prisma` directly without running `prisma
migrate dev` to generate the matching migration, or a migration for them
was written but never committed. Either way, if production's real database
was built by applying `prisma/migrations/` in order (as `CLAUDE.md` §3 says
is the only correct process, and as the `integration-postgres` CI job does
on every PR), **production's actual schema does not match what
`prisma/schema.prisma` — and therefore the generated Prisma Client's
TypeScript types — claim it looks like.**

**This is not just a theoretical risk for one of these fields.** `schema.prisma`
declares `VideoPlaybackSession.maxProgressMs` as `Int @default(0)` (i.e.
non-nullable in the generated TypeScript types), but the real,
migration-built database has this column **nullable with no default**. Every
`prisma.videoPlaybackSession.create(...)` call in
`lib/modules/playback/application/playback.service.ts` (search
`videoPlaybackSession.create`) omits `maxProgressMs` entirely, relying on a
schema-level default that the real database does not have — meaning newly
created sessions likely get `maxProgressMs = NULL` in production today.
Tellingly, `hasCredibleWatchedViewEvidence()` in
`lib/modules/video/application/record-playback-event.use-case.ts` already
types its `maxProgressMs` parameter as `number | null` and guards it with
`Number.isFinite(...) && ... ? ... : 0` — someone already hit this at
runtime and patched around it locally without tracing it back to the
missing migration.

## Scope

1. **Confirm against the real production database** (not just this
   throwaway reconstruction) via `prisma migrate status` /
   `prisma migrate diff --from-url <PROD_DATABASE_URL> --to-schema-datamodel
   prisma/schema.prisma --script` — needs real `DATABASE_URL` access this
   environment doesn't have. Do this before writing any fix migration, to
   confirm the throwaway-DB reconstruction above actually matches
   production's real drift (it should, since production is built the same
   way — by applying `prisma/migrations/` in order — but verify, don't
   assume).
2. For the **7 missing indexes** (`Comment` x2, `PatronGrant`, `Payment`,
   `Video` x3): safe, additive, no data-shape risk. Write one new migration
   file adding exactly these `CREATE INDEX` statements (same low-risk
   pattern as `AUDIT-LOG-INDEX-001`).
3. For the **nullable/default drift** (`BroadcastEmail`, `EmailEvent`,
   `VideoOriginal`, `VideoPlaybackSession`): before writing a migration,
   query production for existing NULL values in each column the diff wants
   to tighten (especially `VideoPlaybackSession.maxProgressMs` going from
   nullable to `NOT NULL DEFAULT 0` — this step **fails outright** if any
   existing row has a NULL there, and Postgres won't backfill it for you).
   Backfill NULLs to the schema's own default first (a data migration,
   separate from the DDL migration) if any exist, then apply the `ALTER
   COLUMN ... SET NOT NULL ... SET DEFAULT ...` migration.
4. For the two `Notification`/`NotificationPreference` FK drop+recreate
   lines: these look identical before and after, which usually means
   `prisma migrate diff` detected an unrelated FK attribute changed
   upstream (e.g. an index needed for the FK, or ordering) — worth a closer
   look with `\d "Notification"` on the real DB before assuming it's inert,
   since Postgres briefly drops referential integrity during the swap.
5. Once real migrations exist for all of the above, re-run the same
   clean-DB reconstruction test this ticket used to confirm zero remaining
   diff between a from-scratch `prisma migrate deploy` and `schema.prisma`.

## Invariants that must survive

- Never edit an existing migration file (`CLAUDE.md` §3) — this is
  additive-only: new migration file(s) for the missing pieces.
- No migration in this ticket may run against production without first
  confirming (via a real, production, read-only query) that no row would
  violate the new `NOT NULL` constraints. A migration that can fail
  mid-deploy on real data is worse than the drift it fixes.
- `record-playback-event.use-case.ts`'s existing `null`-safe handling of
  `maxProgressMs` should stay in place even after the DB column is fixed —
  it's harmless defensive code either way, and removing it isn't part of
  this ticket's scope.

## Non-goals

- Understanding exactly *how* this drift was introduced (which past commit
  hand-edited `schema.prisma` without a migration) — useful context if
  found along the way, not a blocker for fixing it.
- Any schema change beyond reconciling `schema.prisma` with a from-scratch
  migration replay — this ticket does not add new fields/indexes beyond
  what `schema.prisma` already (currently, silently) claims exist.
