-- Durable jobs (notification fan-out, R2 clean-up) and broadcast lease owner. Additive only:
-- one new enum, one new table, one new nullable column, three new indexes. Nothing existing is changed or dropped.

-- CreateEnum
CREATE TYPE "DurableJobStatus" AS ENUM ('PENDING', 'DONE', 'DEAD');

-- AlterTable
ALTER TABLE "BroadcastEmail" ADD COLUMN "lockedBy" TEXT;

-- CreateTable
CREATE TABLE "DurableJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DurableJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "cursor" TEXT,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DurableJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DurableJob_kind_dedupeKey_key" ON "DurableJob"("kind", "dedupeKey");

-- CreateIndex
CREATE INDEX "DurableJob_status_runAfter_idx" ON "DurableJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "Notification_kind_videoId_userId_idx" ON "Notification"("kind", "videoId", "userId");

-- CreateIndex
CREATE INDEX "Subscription_creatorId_userId_idx" ON "Subscription"("creatorId", "userId");
