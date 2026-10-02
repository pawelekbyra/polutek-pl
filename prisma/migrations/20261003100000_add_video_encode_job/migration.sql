-- CreateEnum
CREATE TYPE "VideoEncodeJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VideoEncodeStage" AS ENUM ('QUEUED', 'DOWNLOADING', 'PROBING', 'ENCODING', 'UPLOADING', 'FINALIZING', 'DONE');

-- CreateTable
CREATE TABLE "VideoEncodeJob" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "VideoEncodeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "VideoEncodeStage" NOT NULL DEFAULT 'QUEUED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "etaSeconds" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "failureCode" TEXT,
    "failureReason" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "workerId" TEXT,
    "heartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "requestedById" TEXT,
    "assetId" TEXT,
    "sourceInfo" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoEncodeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoEncodeJob_idempotencyKey_key" ON "VideoEncodeJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "VideoEncodeJob_status_nextAttemptAt_createdAt_idx" ON "VideoEncodeJob"("status", "nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "VideoEncodeJob_videoId_createdAt_idx" ON "VideoEncodeJob"("videoId", "createdAt");

-- CreateIndex
CREATE INDEX "VideoEncodeJob_originalId_idx" ON "VideoEncodeJob"("originalId");

-- AddForeignKey
ALTER TABLE "VideoEncodeJob" ADD CONSTRAINT "VideoEncodeJob_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoEncodeJob" ADD CONSTRAINT "VideoEncodeJob_originalId_fkey" FOREIGN KEY ("originalId") REFERENCES "VideoOriginal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

