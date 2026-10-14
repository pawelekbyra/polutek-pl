-- Wave 1-2 schema (docs/audit/2026-10-14/feature-gap-audit.md): additive only.
-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UPHELD', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'NEW_VIDEO';
ALTER TYPE "NotificationKind" ADD VALUE 'MODERATION';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "notify" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "channelId" TEXT,
ADD COLUMN     "videoId" TEXT;

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "moderationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "newVideoEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "newVideoInApp" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "isAdult" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SubscriberSnapshot" (
    "channelId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "subscribers" INTEGER NOT NULL,

    CONSTRAINT "SubscriberSnapshot_pkey" PRIMARY KEY ("channelId","day")
);

-- CreateTable
CREATE TABLE "VideoProgress" (
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "positionSeconds" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoProgress_pkey" PRIMARY KEY ("userId","videoId")
);

-- CreateTable
CREATE TABLE "ModerationAppeal" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT,
    "text" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByAdminId" TEXT,
    "outcomeDecisionId" TEXT,

    CONSTRAINT "ModerationAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoProgress_userId_updatedAt_idx" ON "VideoProgress"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ModerationAppeal_status_createdAt_idx" ON "ModerationAppeal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAppeal_decisionId_idx" ON "ModerationAppeal"("decisionId");

-- CreateIndex
CREATE INDEX "ModerationAppeal_userId_idx" ON "ModerationAppeal"("userId");

-- AddForeignKey
ALTER TABLE "SubscriberSnapshot" ADD CONSTRAINT "SubscriberSnapshot_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "ModerationDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

