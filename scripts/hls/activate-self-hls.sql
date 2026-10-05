-- Switches ONE video to own HLS (provider SELF_HLS). Idempotent and reversible.
-- Run only AFTER the app version that knows SELF_HLS is deployed (the migration
-- 20261002140000_add_self_hls_storage_provider has been applied): an older app
-- would fail to read the new enum value.
--
--   psql -v ON_ERROR_STOP=1 -v video_id=<uuid> -v version=v1 -f activate-self-hls.sql
--   dry run (everything executed and shown, then rolled back): add  -v finish=ROLLBACK
--
-- Effect: new READY VideoAsset (SELF_HLS) + ACTIVE VideoPlaybackRoute, the previous
-- ACTIVE route becomes PREVIOUS. Manual activation of an already encoded version (the encode worker
-- does this itself in the normal flow). There is no previous-provider fallback or rollback any more.
\if :{?finish}\else\set finish COMMIT\endif
BEGIN;

INSERT INTO "VideoAsset" (id, "videoId", provider, "objectKey", bucket, "mimeType", "updatedAt", "processingState", "isPrimary")
SELECT gen_random_uuid()::text, :'video_id', 'SELF_HLS', 'videos/' || :'video_id' || '/v/' || :'version', 'polutek-hls',
       'application/x-mpegURL', now(), 'READY', false
WHERE NOT EXISTS (
  SELECT 1 FROM "VideoAsset" WHERE "videoId" = :'video_id' AND provider = 'SELF_HLS'
    AND "objectKey" = 'videos/' || :'video_id' || '/v/' || :'version'
);

-- A video served through the legacy "primary asset" rule has no route row yet. Record its
-- current primary asset as PREVIOUS so rollback-self-hls.sql has something to return to.
INSERT INTO "VideoPlaybackRoute" (id, "videoId", "assetId", provider, status, "activatedBy", "activationReason", "deactivatedAt", "updatedAt")
SELECT gen_random_uuid()::text, :'video_id', a.id, a.provider, 'PREVIOUS', 'MIGRATION', 'recorded before self-hosted HLS pilot', now(), now()
FROM "VideoAsset" a
WHERE a."videoId" = :'video_id' AND a."isPrimary" AND a.provider <> 'SELF_HLS'
  AND NOT EXISTS (SELECT 1 FROM "VideoPlaybackRoute" r WHERE r."videoId" = :'video_id');

UPDATE "VideoPlaybackRoute" SET status = 'PREVIOUS', "deactivatedAt" = now(), "updatedAt" = now()
WHERE "videoId" = :'video_id' AND status = 'ACTIVE';

INSERT INTO "VideoPlaybackRoute" (id, "videoId", "assetId", provider, status, "activatedBy", "activationReason", "updatedAt")
SELECT gen_random_uuid()::text, :'video_id', a.id, 'SELF_HLS', 'ACTIVE', 'ADMIN', 'self-hosted HLS pilot', now()
FROM "VideoAsset" a
WHERE a."videoId" = :'video_id' AND a.provider = 'SELF_HLS' AND a."objectKey" = 'videos/' || :'video_id' || '/v/' || :'version';

UPDATE "Video" SET "activePlaybackRouteId" = (
  SELECT r.id FROM "VideoPlaybackRoute" r WHERE r."videoId" = :'video_id' AND r.status = 'ACTIVE' ORDER BY r."createdAt" DESC LIMIT 1
) WHERE id = :'video_id';

UPDATE "VideoAsset" SET "isPrimary" = (provider = 'SELF_HLS' AND "objectKey" = 'videos/' || :'video_id' || '/v/' || :'version')
WHERE "videoId" = :'video_id';

\echo --- state after (before :finish):
SELECT v.slug, v."activePlaybackRouteId" = r.id AS active_route_is_this, r.provider AS route_provider, r.status,
       a.provider AS asset_provider, a."objectKey", a."isPrimary"
FROM "Video" v
JOIN "VideoPlaybackRoute" r ON r."videoId" = v.id
JOIN "VideoAsset" a ON a.id = r."assetId"
WHERE v.id = :'video_id' ORDER BY r."createdAt";
:finish;
