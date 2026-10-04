-- Film translations (docs/architecture/translations-concept.md, admin-phase2-content.md section 6).
-- Additive and idempotent: safe to re-run. Nothing reads these tables on the public site yet; the site and
-- the player keep reading Video.titleEn/descriptionEn/subtitleUrlPl/subtitleUrlEn.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VideoTranslationStatus') THEN
    CREATE TYPE "VideoTranslationStatus" AS ENUM ('AI_DRAFT', 'APPROVED', 'EDITED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "VideoTranslation" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "subtitleUrl" TEXT,
    "status" "VideoTranslationStatus" NOT NULL DEFAULT 'AI_DRAFT',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VideoSlugHistory" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoSlugHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VideoTranslation_language_status_idx" ON "VideoTranslation"("language", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "VideoTranslation_videoId_language_key" ON "VideoTranslation"("videoId", "language");
CREATE UNIQUE INDEX IF NOT EXISTS "VideoTranslation_language_slug_key" ON "VideoTranslation"("language", "slug");
CREATE INDEX IF NOT EXISTS "VideoSlugHistory_videoId_idx" ON "VideoSlugHistory"("videoId");
CREATE UNIQUE INDEX IF NOT EXISTS "VideoSlugHistory_language_slug_key" ON "VideoSlugHistory"("language", "slug");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VideoTranslation_videoId_fkey') THEN
    ALTER TABLE "VideoTranslation" ADD CONSTRAINT "VideoTranslation_videoId_fkey"
      FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VideoSlugHistory_videoId_fkey') THEN
    ALTER TABLE "VideoSlugHistory" ADD CONSTRAINT "VideoSlugHistory_videoId_fkey"
      FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Existing English texts written by people become the "en" translation (EDITED). The address reuses the
-- film's own slug, which is unique, so no collision is possible. The Video columns stay as they are.
INSERT INTO "VideoTranslation" ("id", "videoId", "language", "title", "slug", "description", "subtitleUrl", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v."id", 'en', v."titleEn", v."slug", v."descriptionEn", v."subtitleUrlEn", 'EDITED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Video" v
WHERE v."titleEn" IS NOT NULL AND btrim(v."titleEn") <> ''
ON CONFLICT DO NOTHING;
