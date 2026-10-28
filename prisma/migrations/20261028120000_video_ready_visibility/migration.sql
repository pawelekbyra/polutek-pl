-- Target visibility of "publish when ready", stored next to the flag. Additive only: one new nullable column.
-- NULL = unknown (rows created before this migration): the auto-publication then falls back to the legacy
-- AppSetting `video_ready_visibility:<id>` and, without it, stops instead of publishing.
ALTER TABLE "Video" ADD COLUMN "publishAfterAssetReadyVisibility" TEXT;
