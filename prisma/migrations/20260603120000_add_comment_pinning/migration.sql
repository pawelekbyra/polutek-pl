-- Add optional pinning metadata for top-level comments.
ALTER TABLE "Comment" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN "pinnedById" TEXT;

CREATE INDEX "Comment_videoId_pinnedAt_createdAt_idx" ON "Comment"("videoId", "pinnedAt", "createdAt");
CREATE UNIQUE INDEX "Comment_one_pinned_per_video_idx" ON "Comment"("videoId") WHERE "pinnedAt" IS NOT NULL AND "parentId" IS NULL AND "deletedAt" IS NULL;
