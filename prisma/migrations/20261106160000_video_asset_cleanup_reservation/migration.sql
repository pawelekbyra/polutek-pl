ALTER TABLE "VideoAsset"
  ADD COLUMN "cleanupPendingAt" TIMESTAMP(3);

CREATE FUNCTION "reject_cleanup_reserved_playback_route"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  reserved_at TIMESTAMP(3);
BEGIN
  IF NEW."status" = 'ACTIVE'::"VideoPlaybackRouteStatus" THEN
    PERFORM 1 FROM "Video" WHERE "id" = NEW."videoId" FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot activate a route for a missing video';
    END IF;

    SELECT "cleanupPendingAt" INTO reserved_at
    FROM "VideoAsset"
    WHERE "id" = NEW."assetId" AND "videoId" = NEW."videoId"
    FOR UPDATE;
    IF NOT FOUND OR reserved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot activate an HLS asset reserved for cleanup';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "VideoPlaybackRoute_reject_cleanup_reserved_asset"
  BEFORE INSERT OR UPDATE OF "status", "assetId", "videoId"
  ON "VideoPlaybackRoute"
  FOR EACH ROW
  EXECUTE FUNCTION "reject_cleanup_reserved_playback_route"();
