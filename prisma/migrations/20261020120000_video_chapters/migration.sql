-- Video chapters (docs/architecture/video-chapters.md). Additive only: one nullable column and one CHECK.
ALTER TABLE "Video" ADD COLUMN "chapters" JSONB;
ALTER TABLE "Video" ADD CONSTRAINT "Video_chapters_shape_check"
  CHECK ("chapters" IS NULL OR (jsonb_typeof("chapters") = 'array' AND jsonb_array_length("chapters") BETWEEN 1 AND 50));
