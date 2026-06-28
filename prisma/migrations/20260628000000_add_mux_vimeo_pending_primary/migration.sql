-- Add VIMEO to StorageProvider enum
ALTER TYPE "StorageProvider" ADD VALUE IF NOT EXISTS 'VIMEO';

-- Add pendingPrimaryIntent and muxUploadId to VideoAsset
ALTER TABLE "VideoAsset" ADD COLUMN IF NOT EXISTS "pendingPrimaryIntent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VideoAsset" ADD COLUMN IF NOT EXISTS "muxUploadId" TEXT;
