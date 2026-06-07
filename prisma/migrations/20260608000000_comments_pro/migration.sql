-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'HELD_FOR_REVIEW', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "CommentDeletedReason" AS ENUM ('AUTHOR_DELETED', 'MODERATOR_DELETED', 'SPAM', 'ABUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "CommentReactionType" AS ENUM ('LIKE');

-- CreateEnum
CREATE TYPE "CommentReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE', 'NSFW', 'SPOILER', 'OTHER');

-- CreateEnum
CREATE TYPE "CommentReportStatus" AS ENUM ('PENDING', 'DISMISSED', 'ACTION_TAKEN');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "status" "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
ADD COLUMN     "likesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "repliesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reportsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "deletedReason" "CommentDeletedReason",
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedById" TEXT;

-- CreateTable
CREATE TABLE "CommentReaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "type" "CommentReactionType" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentReport" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "CommentReportReason" NOT NULL,
    "note" TEXT,
    "status" "CommentReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "CommentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommentReaction_userId_commentId_key" ON "CommentReaction"("userId", "commentId");

-- CreateIndex
CREATE INDEX "CommentReaction_commentId_type_idx" ON "CommentReaction"("commentId", "type");

-- CreateIndex
CREATE INDEX "CommentReaction_userId_idx" ON "CommentReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentReport_commentId_reporterId_key" ON "CommentReport"("commentId", "reporterId");

-- CreateIndex
CREATE INDEX "CommentReport_status_createdAt_idx" ON "CommentReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommentReport_commentId_idx" ON "CommentReport"("commentId");

-- CreateIndex
CREATE INDEX "CommentReport_reporterId_idx" ON "CommentReport"("reporterId");

-- AddForeignKey
ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReport" ADD CONSTRAINT "CommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReport" ADD CONSTRAINT "CommentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index for status
CREATE INDEX "Comment_status_idx" ON "Comment"("status");

-- DATA BACKFILL --

-- 1. Migrate CommentLike to CommentReaction
INSERT INTO "CommentReaction" ("id", "userId", "commentId", "type", "createdAt")
SELECT gen_random_uuid(), "userId", "commentId", 'LIKE', "createdAt"
FROM "CommentLike"
ON CONFLICT DO NOTHING;

-- 2. Update Comment Status for existing deleted comments
UPDATE "Comment" SET "status" = 'DELETED', "deletedReason" = 'AUTHOR_DELETED' WHERE "deletedAt" IS NOT NULL;

-- 3. Calculate likesCount
UPDATE "Comment" c
SET "likesCount" = (SELECT COUNT(*) FROM "CommentReaction" r WHERE r."commentId" = c.id AND r."type" = 'LIKE');

-- 4. Calculate repliesCount
UPDATE "Comment" c
SET "repliesCount" = (SELECT COUNT(*) FROM "Comment" r WHERE r."parentId" = c.id);

-- 5. Set initial score
UPDATE "Comment" SET "score" = "likesCount";
