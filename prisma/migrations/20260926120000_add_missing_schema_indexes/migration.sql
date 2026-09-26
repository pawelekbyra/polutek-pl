-- Reconciles schema.prisma with the applied migration history (PRISMA-SCHEMA-MIGRATION-DRIFT-001).
-- These 7 indexes are declared in schema.prisma but were never created by any
-- migration file (confirmed via `prisma migrate diff` against a from-scratch
-- replay of the full migration history). Purely additive, no data risk.
--
-- Every statement below is IF [NOT] EXISTS: the whole point of this ticket is
-- that schema.prisma may have been hand-edited to match objects that already
-- exist on a real database via an out-of-band change (the ticket's own
-- "Why" section flags this as the likely origin of the drift). Using
-- IF [NOT] EXISTS makes this migration safe to apply regardless of whether
-- the real database already has some or all of these objects, matching the
-- established pattern in this repo for exactly this situation (see
-- 20260625121500_add_payment_request_id's own comment).

-- DropIndex
-- Created by 20260607000000_fix_schema_consistency but never carried into
-- schema.prisma's @@index list (superseded by the more targeted
-- VideoPlaybackSession indexes on startedAt/countedAsView/etc. added since).
-- Dropping an index is always safe: no data loss, only a query-plan change.
DROP INDEX IF EXISTS "VideoPlaybackSession_createdAt_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_videoId_createdAt_idx" ON "Comment"("videoId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PatronGrant_userId_revokedAt_idx" ON "PatronGrant"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_userId_status_idx" ON "Payment"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Video_status_publishedAt_idx" ON "Video"("status", "publishedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Video_status_createdAt_idx" ON "Video"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Video_creatorId_status_idx" ON "Video"("creatorId", "status");
