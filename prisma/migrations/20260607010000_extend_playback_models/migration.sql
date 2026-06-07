-- Extend VideoPlaybackSession table
ALTER TABLE "VideoPlaybackSession" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "VideoPlaybackSession" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "VideoPlaybackSession" ADD COLUMN IF NOT EXISTS "firstPlayAt" TIMESTAMP(3);
ALTER TABLE "VideoPlaybackSession" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
ALTER TABLE "VideoPlaybackSession" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "VideoPlaybackSession" ADD COLUMN IF NOT EXISTS "errorCode" TEXT;
ALTER TABLE "VideoPlaybackSession" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;

-- Adjust existing columns for VideoPlaybackSession
ALTER TABLE "VideoPlaybackSession" ALTER COLUMN "sourceKind" DROP NOT NULL;
ALTER TABLE "VideoPlaybackSession" ALTER COLUMN "maxProgressMs" SET DEFAULT 0;
UPDATE "VideoPlaybackSession" SET "maxProgressMs" = 0 WHERE "maxProgressMs" IS NULL;
ALTER TABLE "VideoPlaybackSession" ALTER COLUMN "maxProgressMs" SET NOT NULL;
ALTER TABLE "VideoPlaybackSession" ALTER COLUMN "lastHeartbeatAt" DROP NOT NULL;

-- Extend VideoPlaybackEvent table
ALTER TABLE "VideoPlaybackEvent" ADD COLUMN IF NOT EXISTS "bufferedMs" INTEGER;
ALTER TABLE "VideoPlaybackEvent" ADD COLUMN IF NOT EXISTS "volume" DOUBLE PRECISION;
ALTER TABLE "VideoPlaybackEvent" ADD COLUMN IF NOT EXISTS "muted" BOOLEAN;
ALTER TABLE "VideoPlaybackEvent" ADD COLUMN IF NOT EXISTS "fullscreen" BOOLEAN;
ALTER TABLE "VideoPlaybackEvent" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "VideoPlaybackEvent" ADD COLUMN IF NOT EXISTS "sourceKind" TEXT;
ALTER TABLE "VideoPlaybackEvent" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Create missing indexes for VideoPlaybackSession
CREATE INDEX IF NOT EXISTS "VideoPlaybackSession_countedAsView_idx" ON "VideoPlaybackSession"("countedAsView");
CREATE INDEX IF NOT EXISTS "VideoPlaybackSession_startedAt_idx" ON "VideoPlaybackSession"("startedAt");
CREATE INDEX IF NOT EXISTS "VideoPlaybackSession_isAdminPreview_idx" ON "VideoPlaybackSession"("isAdminPreview");

-- Create missing indexes for VideoPlaybackEvent
CREATE INDEX IF NOT EXISTS "VideoPlaybackEvent_userId_idx" ON "VideoPlaybackEvent"("userId");
