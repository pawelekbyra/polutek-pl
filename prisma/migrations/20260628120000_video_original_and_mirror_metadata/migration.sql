-- Add mirror metadata fields to VideoAsset
ALTER TABLE "VideoAsset" ADD COLUMN IF NOT EXISTS "fallbackPriority" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "VideoAsset" ADD COLUMN IF NOT EXISTS "mirrorSourceOriginalId" TEXT;
ALTER TABLE "VideoAsset" ADD COLUMN IF NOT EXISTS "mirrorRequestedAt" TIMESTAMP(3);
ALTER TABLE "VideoAsset" ADD COLUMN IF NOT EXISTS "mirrorCompletedAt" TIMESTAMP(3);
ALTER TABLE "VideoAsset" ADD COLUMN IF NOT EXISTS "mirrorFailureReason" TEXT;

-- Create VideoOriginal table
CREATE TABLE IF NOT EXISTS "VideoOriginal" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "checksumSha256" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    "failureReason" TEXT,
    "uploadStartedAt" TIMESTAMP(3),
    "uploadCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoOriginal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VideoOriginal_videoId_key" ON "VideoOriginal"("videoId");
CREATE INDEX IF NOT EXISTS "VideoOriginal_videoId_idx" ON "VideoOriginal"("videoId");
CREATE INDEX IF NOT EXISTS "VideoOriginal_status_idx" ON "VideoOriginal"("status");

ALTER TABLE "VideoOriginal" ADD CONSTRAINT "VideoOriginal_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
