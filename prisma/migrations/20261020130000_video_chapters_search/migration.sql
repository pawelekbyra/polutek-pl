-- Chapter titles become searchable (docs/architecture/video-chapters.md section 10). Additive: the trigger function is
-- replaced (the earlier migration 20261019170000_video_search is never edited) and the trigger now also fires when
-- "chapters" changes. video_search_normalize() and the index definitions are untouched.
--
-- Like the description, chapter titles (PL and EN) go into "searchText" for PUBLIC videos only: a video that is not
-- PUBLIC is found by title and tags and nothing else. "chapters" is JSONB with a CHECK (array of 1-50 items), but the
-- function stays safe for any value: jsonb_array_elements() is only called on an array, and ->> on a non-object is NULL.
-- Rollback: a new migration that restores the function and trigger of 20261019170000_video_search, or a pre-deploy dump.

CREATE OR REPLACE FUNCTION video_search_refresh() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parts text[];
  chapter_text text;
BEGIN
  chapter_text := NULL;
  IF NEW."tier" = 'PUBLIC' AND NEW."chapters" IS NOT NULL AND jsonb_typeof(NEW."chapters") = 'array' THEN
    SELECT string_agg(concat_ws(' ', c->>'title', c->>'titleEn'), ' ')
      INTO chapter_text
      FROM jsonb_array_elements(NEW."chapters") AS c;
  END IF;

  NEW."searchText" := video_search_normalize(concat_ws(' ',
    NEW."title",
    NEW."titleEn",
    array_to_string(NEW."tags", ' '),
    NEW."category",
    CASE WHEN NEW."tier" = 'PUBLIC' THEN left(concat_ws(' ', NEW."description", NEW."descriptionEn"), 3000) END,
    left(chapter_text, 2000)
  ));

  NEW."durationSeconds" := NULL;
  IF NEW."duration" ~ '^[0-9]{1,3}(:[0-9]{1,2}){1,2}$' THEN
    parts := string_to_array(NEW."duration", ':');
    IF array_length(parts, 1) = 2 THEN
      NEW."durationSeconds" := parts[1]::int * 60 + parts[2]::int;
    ELSE
      NEW."durationSeconds" := parts[1]::int * 3600 + parts[2]::int * 60 + parts[3]::int;
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "Video_search_refresh" ON "Video";
CREATE TRIGGER "Video_search_refresh"
BEFORE INSERT OR UPDATE OF "title", "titleEn", "description", "descriptionEn", "tags", "category", "tier", "duration", "chapters"
ON "Video"
FOR EACH ROW EXECUTE FUNCTION video_search_refresh();

-- Backfill: naming a column in SET fires the trigger even though the value stays the same.
UPDATE "Video" SET "title" = "title";
