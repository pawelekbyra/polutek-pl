-- Stage 8, deployment B (docs/architecture/stage-8-deploy-B.md, CLAUDE.md 4.0 and 4.24). DESTRUCTIVE.
-- Drops the legacy "Creator"."isPrimary" and "Creator"."isApproved" columns. Their replacements are the AppSetting
-- "main_channel_id" (main channel, seeded by migration 20261014090000) and "Creator"."status" (public visibility).
--
-- Safe order: the code of deployment B (schema without these fields) is rolled out first; Prisma then no longer
-- selects the columns, so this migration only removes dead data. Rolling back needs the pre-deploy database dump.
--
-- Guard: when any channel exists, the main_channel_id setting must exist, be non-empty and point at an existing
-- channel; otherwise the migration aborts BEFORE anything is dropped (deployment A has not run or its backfill is
-- missing). An empty database (no "Creator" rows, e.g. a fresh test database) passes without a setting.
-- The columns carry no indexes, constraints or keys (checked in prisma/migrations: 0_init only creates columns),
-- so a plain DROP COLUMN is enough; no CASCADE, so an unexpected dependency aborts the migration.

DO $$
DECLARE
  v_setting text;
BEGIN
  IF EXISTS (SELECT 1 FROM "Creator") THEN
    SELECT "value" INTO v_setting FROM "AppSetting" WHERE "key" = 'main_channel_id';
    IF v_setting IS NULL OR btrim(v_setting) = '' THEN
      RAISE EXCEPTION 'main_channel_id missing: run deployment A first (migration 20261014090000_main_channel_setting), then set the main channel in AppSetting';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM "Creator" WHERE "id" = btrim(v_setting)) THEN
      RAISE EXCEPTION 'main_channel_id points at a channel that does not exist (%): fix the AppSetting before dropping the legacy flags', v_setting;
    END IF;
  END IF;
END
$$;

ALTER TABLE "Creator" DROP COLUMN "isPrimary", DROP COLUMN "isApproved";
