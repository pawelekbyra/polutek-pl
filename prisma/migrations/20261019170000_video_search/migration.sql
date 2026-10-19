-- Cross-channel video search without new Postgres extensions (no pg_trgm, no unaccent).
-- Additive only: two new columns, one function pair, one trigger and three partial indexes.
--
-- "searchText" is a normalized copy of what is searchable about a video (title in both languages, tags, category and, for
-- PUBLIC videos only, the description), kept up to date by a trigger so every write path (Studio, panel, scripts) is covered.
-- Diacritics are folded with translate() and punctuation collapsed to single spaces, mirroring normalizeSearchText() in
-- lib/modules/video/domain/search-query.ts (a unit test compares both character tables).
-- "durationSeconds" is the "duration" text ("12:45", "1:02:03") parsed once, for the duration filter.

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "durationSeconds" INTEGER;

CREATE OR REPLACE FUNCTION video_search_normalize(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        lower(translate(coalesce(input, ''), 'ąáàâäãåāăĄÁÀÂÄÃÅĀĂćçčĆÇČďĎęéèêëēěĘÉÈÊËĒĚíìîïīÍÌÎÏĪłŁńñňŃÑŇóòôöõøōőÓÒÔÖÕØŌŐřŘśšßŚŠťŤúùûüūůűÚÙÛÜŪŮŰýÿÝŸżźžŻŹŽ', 'aaaaaaaaaaaaaaaaaaccccccddeeeeeeeeeeeeeeiiiiiiiiiillnnnnnnoooooooooooooooorrsssssttuuuuuuuuuuuuuuyyyyzzzzzz')),
        '[̀-ͯ]', '', 'g'),
      '[\s!-/:-@\[-`{-~„”“‚‘’«»–—…]+', ' ', 'g')
  )
$$;

CREATE OR REPLACE FUNCTION video_search_refresh() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parts text[];
BEGIN
  NEW."searchText" := video_search_normalize(concat_ws(' ',
    NEW."title",
    NEW."titleEn",
    array_to_string(NEW."tags", ' '),
    NEW."category",
    CASE WHEN NEW."tier" = 'PUBLIC' THEN left(concat_ws(' ', NEW."description", NEW."descriptionEn"), 3000) END
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

CREATE TRIGGER "Video_search_refresh"
BEFORE INSERT OR UPDATE OF "title", "titleEn", "description", "descriptionEn", "tags", "category", "tier", "duration"
ON "Video"
FOR EACH ROW EXECUTE FUNCTION video_search_refresh();

-- Backfill: naming a column in SET fires the trigger even though the value stays the same.
UPDATE "Video" SET "title" = "title";

-- Prefix word search (to_tsquery('simple', 'word:*')) over published videos.
CREATE INDEX "Video_published_search_fts_idx" ON "Video" USING GIN (to_tsvector('simple', "searchText")) WHERE "status" = 'PUBLISHED';

-- Category browse and "most viewed" sort over published videos.
CREATE INDEX "Video_published_category_idx" ON "Video" ("category", "publishedAt" DESC) WHERE "status" = 'PUBLISHED' AND "category" IS NOT NULL;
CREATE INDEX "Video_published_views_idx" ON "Video" ("views" DESC, "publishedAt" DESC) WHERE "status" = 'PUBLISHED';
