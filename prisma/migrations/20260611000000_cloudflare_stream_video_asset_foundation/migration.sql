-- X3-FIX-001: Cloudflare Stream-first VideoAsset foundation.
-- Existing R2/S3/VERCEL_BLOB providers are preserved as legacy/migration-compatible values.

ALTER TYPE "StorageProvider" ADD VALUE IF NOT EXISTS 'CLOUDFLARE_STREAM';
ALTER TYPE "StorageProvider" ADD VALUE IF NOT EXISTS 'MUX';

CREATE TYPE "VideoAssetProcessingState" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'READY', 'FAILED');

ALTER TABLE "VideoAsset"
  ADD COLUMN "providerAssetId" TEXT,
  ADD COLUMN "providerPlaybackId" TEXT,
  ADD COLUMN "processingState" "VideoAssetProcessingState" NOT NULL DEFAULT 'READY',
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "providerSyncedAt" TIMESTAMP(3),
  ADD COLUMN "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN "processingEndedAt" TIMESTAMP(3);

CREATE INDEX "VideoAsset_processingState_idx" ON "VideoAsset"("processingState");
CREATE INDEX "VideoAsset_provider_providerAssetId_idx" ON "VideoAsset"("provider", "providerAssetId");
