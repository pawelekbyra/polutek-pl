-- Deletes the leftover rows of the removed third-party video providers (Mux, Cloudflare Stream,
-- YouTube, Vimeo, and legacy storage assets) AFTER the app version that ignores them is deployed
-- (CLAUDE.md 4.17: own HLS is the only video source). Run it once, after the deploy.
--
--   dry run (everything executed and shown, then rolled back):
--     psql -v ON_ERROR_STOP=1 -v finish=ROLLBACK -f delete-legacy-provider-rows.sql
--   for real (on serwerek, as the other scripts: docs/operations/VIDEO-PIPELINE.md "Po wdrozeniu"):
--     psql -v ON_ERROR_STOP=1 -f delete-legacy-provider-rows.sql
--
-- Safety: it refuses to run (raises) when any video that has a legacy asset does not already play
-- from an ACTIVE route to a READY SELF_HLS asset, so it can never leave a video without a source.
-- Deleting a VideoAsset cascades to its VideoPlaybackRoute rows (the old PREVIOUS routes); the
-- ACTIVE own-HLS route and its asset are never touched. Legacy plan/target/job/webhook-event rows
-- of the removed providers are deleted too (the tables stay: migrations are additive).
-- Nothing is deleted at Mux/Cloudflare by this script: do that in their dashboards/APIs
-- (docs/operations/SERWEREK.md, "Sprzatanie po dostawcach").
\if :{?finish}\else\set finish COMMIT\endif
BEGIN;

\echo --- before: legacy rows
SELECT provider, count(*) AS assets FROM "VideoAsset" WHERE provider <> 'SELF_HLS' GROUP BY provider ORDER BY provider;
SELECT provider, status, count(*) AS routes FROM "VideoPlaybackRoute" WHERE provider <> 'SELF_HLS' GROUP BY provider, status ORDER BY provider, status;

DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(v.slug, ', ') INTO bad
  FROM "Video" v
  WHERE EXISTS (SELECT 1 FROM "VideoAsset" a WHERE a."videoId" = v.id AND a.provider <> 'SELF_HLS')
    AND NOT EXISTS (
      SELECT 1
      FROM "VideoPlaybackRoute" r
      JOIN "VideoAsset" a ON a.id = r."assetId"
      WHERE r."videoId" = v.id AND r.status = 'ACTIVE' AND r.id = v."activePlaybackRouteId"
        AND a.provider = 'SELF_HLS' AND a."processingState" = 'READY'
    );
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to delete legacy rows: these videos have no ACTIVE route to a READY SELF_HLS asset: %', bad;
  END IF;
END $$;

-- Provider bookkeeping first (jobs reference assets/targets/plans with ON DELETE SET NULL, but there is no reason to keep them).
DELETE FROM "VideoProviderJob";
DELETE FROM "VideoProviderWebhookEvent";
DELETE FROM "VideoDistributionTarget";
DELETE FROM "VideoDistributionPlan";

-- Legacy routes (not the ACTIVE own-HLS one) and legacy assets (cascades to any remaining route rows of those assets).
DELETE FROM "VideoPlaybackRoute" WHERE provider <> 'SELF_HLS';
DELETE FROM "VideoAsset" WHERE provider <> 'SELF_HLS';

-- The raw legacy URL column: nothing reads it any more.
UPDATE "Video" SET "videoUrl" = NULL WHERE "videoUrl" IS NOT NULL;

\echo --- after: every video, its active route and source (must all be SELF_HLS / READY)
SELECT v.slug, v.status, r.provider AS route_provider, r.status AS route_status, a.provider AS asset_provider,
       a."processingState", a."objectKey", a."isPrimary"
FROM "Video" v
LEFT JOIN "VideoPlaybackRoute" r ON r.id = v."activePlaybackRouteId"
LEFT JOIN "VideoAsset" a ON a.id = r."assetId"
ORDER BY v.slug;
SELECT (SELECT count(*) FROM "VideoAsset" WHERE provider <> 'SELF_HLS') AS legacy_assets_left,
       (SELECT count(*) FROM "VideoPlaybackRoute" WHERE provider <> 'SELF_HLS') AS legacy_routes_left;
:finish;
