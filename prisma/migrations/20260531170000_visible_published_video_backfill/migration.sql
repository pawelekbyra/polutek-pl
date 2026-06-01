-- Backfill publishedAt for already PUBLISHED videos
UPDATE "Video" SET "publishedAt" = "createdAt" WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NULL;
