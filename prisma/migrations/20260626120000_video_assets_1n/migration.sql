-- Allow a single Video to own multiple technical VideoAsset records.
-- Existing data remains valid because the previous unique constraint meant
-- every video had at most one asset before this migration.
DROP INDEX IF EXISTS "VideoAsset_videoId_key";

CREATE INDEX IF NOT EXISTS "VideoAsset_videoId_idx" ON "VideoAsset"("videoId");
CREATE INDEX IF NOT EXISTS "VideoAsset_videoId_isPrimary_idx" ON "VideoAsset"("videoId", "isPrimary");
