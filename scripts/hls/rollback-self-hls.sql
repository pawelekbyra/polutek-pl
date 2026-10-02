-- Instant rollback of one video from own HLS to its previous provider.
--   psql -v ON_ERROR_STOP=1 -v video_id=<uuid> -f rollback-self-hls.sql
--   dry run: add  -v finish=ROLLBACK
-- The SELF_HLS route is disabled, the most recent PREVIOUS route (the old provider)
-- is ACTIVE again and its asset is primary. The SELF_HLS asset row stays (not primary),
-- so activating again later is just activate-self-hls.sql.
\if :{?finish}\else\set finish COMMIT\endif
BEGIN;

UPDATE "VideoPlaybackRoute" SET status = 'DISABLED', "deactivatedAt" = now(), "updatedAt" = now()
WHERE "videoId" = :'video_id' AND provider = 'SELF_HLS' AND status = 'ACTIVE';

UPDATE "VideoPlaybackRoute" SET status = 'ACTIVE', "deactivatedAt" = NULL, "updatedAt" = now()
WHERE id = (
  SELECT id FROM "VideoPlaybackRoute"
  WHERE "videoId" = :'video_id' AND provider <> 'SELF_HLS' AND status = 'PREVIOUS'
  ORDER BY "activatedAt" DESC LIMIT 1
);

UPDATE "Video" SET "activePlaybackRouteId" = (
  SELECT id FROM "VideoPlaybackRoute" WHERE "videoId" = :'video_id' AND status = 'ACTIVE' ORDER BY "createdAt" DESC LIMIT 1
) WHERE id = :'video_id';

UPDATE "VideoAsset" a SET "isPrimary" = (a.provider <> 'SELF_HLS' AND a.id = (
  SELECT "assetId" FROM "VideoPlaybackRoute" WHERE "videoId" = :'video_id' AND status = 'ACTIVE' LIMIT 1
)) WHERE a."videoId" = :'video_id';

\echo --- state after (before :finish):
SELECT v.slug, v."activePlaybackRouteId" = r.id AS active_route_is_this, r.provider AS route_provider, r.status,
       a.provider AS asset_provider, a."objectKey", a."isPrimary"
FROM "Video" v
JOIN "VideoPlaybackRoute" r ON r."videoId" = v.id
JOIN "VideoAsset" a ON a.id = r."assetId"
WHERE v.id = :'video_id' ORDER BY r."createdAt";
:finish;
