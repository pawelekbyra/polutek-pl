-- Stage 8, deployment A (docs/architecture/stage-8-cleanup-plan.md, CLAUDE.md 4.0 and 4.24).
-- The platform's main channel (the one the home page shows) becomes the AppSetting "main_channel_id".
-- Additive and idempotent: it only inserts one settings row, and only when none exists yet
-- (ON CONFLICT DO NOTHING keeps an operator's later choice). "Creator"."isPrimary" is read here for the
-- last time as a source of truth; the column itself is dropped in deployment B.
-- Preference order: a channel that is not deleted first, then the oldest, then the lowest id (deterministic, one row).

INSERT INTO "AppSetting" ("key", "value", "updatedAt")
SELECT 'main_channel_id', c."id", CURRENT_TIMESTAMP
FROM "Creator" c
WHERE c."isPrimary" = true
ORDER BY (c."deletedAt" IS NOT NULL) ASC, c."createdAt" ASC, c."id" ASC
LIMIT 1
ON CONFLICT ("key") DO NOTHING;
