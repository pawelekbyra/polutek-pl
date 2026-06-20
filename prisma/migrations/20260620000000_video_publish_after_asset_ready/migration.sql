ALTER TABLE "Video"
  ADD COLUMN "publishAfterAssetReady" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishAfterAssetReadyRequestedAt" TIMESTAMP(3),
  ADD COLUMN "publishAfterAssetReadyCompletedAt" TIMESTAMP(3),
  ADD COLUMN "publishAfterAssetReadyError" TEXT;

CREATE INDEX "Video_publishAfterAssetReady_idx" ON "Video"("publishAfterAssetReady");
