-- CreateTable
CREATE TABLE "VideoOriginal" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'R2',
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "checksumSha256" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    "failureReason" TEXT,
    "uploadStartedAt" TIMESTAMP(3),
    "uploadCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoOriginal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoOriginal_videoId_key" ON "VideoOriginal"("videoId");

-- CreateIndex
CREATE INDEX "VideoOriginal_status_idx" ON "VideoOriginal"("status");

-- CreateIndex
CREATE INDEX "VideoOriginal_bucket_objectKey_idx" ON "VideoOriginal"("bucket", "objectKey");

-- AddForeignKey
ALTER TABLE "VideoOriginal" ADD CONSTRAINT "VideoOriginal_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
