-- Premiere notifications (CLAUDE.md 4.18): additive only. NULL = viewers not told about the video yet.
ALTER TABLE "Video" ADD COLUMN "premiereNotifiedAt" TIMESTAMP(3);

-- Videos that are already live must never be announced by the premiere cron: only videos whose premiere is
-- still ahead stay NULL (they are announced when premiereAt passes).
UPDATE "Video" SET "premiereNotifiedAt" = COALESCE("publishedAt", NOW())
WHERE "premiereNotifiedAt" IS NULL AND ("premiereAt" IS NULL OR "premiereAt" <= NOW());
