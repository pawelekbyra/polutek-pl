-- Public Cloudflare R2 copy of a published video's thumbnail (MEDIA-THUMBNAILS-R2-MIGRATION-001).
-- Nullable and additive: existing rows keep serving through /api/videos/[id]/thumbnail.
ALTER TABLE "Video" ADD COLUMN "thumbnailPublicUrl" TEXT;
