-- Add YOUTUBE to StorageProvider enum and extend VideoAsset with external source fields.
ALTER TYPE "StorageProvider" ADD VALUE IF NOT EXISTS 'YOUTUBE';

ALTER TABLE "VideoAsset"
  ADD COLUMN IF NOT EXISTS "externalVideoId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalUrl"     TEXT;
