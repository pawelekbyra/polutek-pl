-- Reconciles schema.prisma with the applied migration history (PRISMA-SCHEMA-MIGRATION-DRIFT-001).
-- These 7 indexes are declared in schema.prisma but were never created by any
-- migration file (confirmed via `prisma migrate diff` against a from-scratch
-- replay of the full migration history). Purely additive, no data risk.

-- DropIndex
-- Created by 20260607000000_fix_schema_consistency but never carried into
-- schema.prisma's @@index list (superseded by the more targeted
-- VideoPlaybackSession indexes on startedAt/countedAsView/etc. added since).
-- Dropping an index is always safe: no data loss, only a query-plan change.
DROP INDEX "VideoPlaybackSession_createdAt_idx";

-- CreateIndex
CREATE INDEX "Comment_videoId_createdAt_idx" ON "Comment"("videoId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "PatronGrant_userId_revokedAt_idx" ON "PatronGrant"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");

-- CreateIndex
CREATE INDEX "Video_status_publishedAt_idx" ON "Video"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Video_status_createdAt_idx" ON "Video"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Video_creatorId_status_idx" ON "Video"("creatorId", "status");
