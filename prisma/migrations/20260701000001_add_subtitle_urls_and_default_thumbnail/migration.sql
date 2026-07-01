-- AlterTable Video: add optional subtitle URL fields
ALTER TABLE "Video" ADD COLUMN "subtitleUrlPl" TEXT;
ALTER TABLE "Video" ADD COLUMN "subtitleUrlEn" TEXT;

-- AlterTable Creator: add optional default thumbnail URL
ALTER TABLE "Creator" ADD COLUMN "defaultThumbnailUrl" TEXT;
