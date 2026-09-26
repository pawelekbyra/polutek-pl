-- Reconciles schema.prisma with the applied migration history (PRISMA-SCHEMA-MIGRATION-DRIFT-001).
--
-- These nullability/default changes were declared in schema.prisma without a
-- matching migration ever being written. Most of them only loosen a
-- constraint (DROP NOT NULL / DROP DEFAULT / a new DEFAULT for future rows),
-- which is always safe against existing data. The one exception is
-- VideoPlaybackSession.maxProgressMs, which schema.prisma has always declared
-- non-nullable with a default of 0, but the real column (built purely from
-- migration files) is nullable with no default — every
-- `prisma.videoPlaybackSession.create()` call omits maxProgressMs and relies
-- on the (nonexistent) DB default, so existing rows may already have NULL
-- here. Backfill any such rows to 0 (schema.prisma's own default) before
-- tightening the column, so this migration cannot fail mid-deploy on
-- production data.

-- Backfill: bring any NULL maxProgressMs in line with schema.prisma's declared
-- default before making the column NOT NULL.
UPDATE "VideoPlaybackSession" SET "maxProgressMs" = 0 WHERE "maxProgressMs" IS NULL;

-- AlterTable
ALTER TABLE "BroadcastEmail" ALTER COLUMN "sentAt" DROP NOT NULL,
ALTER COLUMN "sentAt" DROP DEFAULT,
ALTER COLUMN "recipientCount" SET DEFAULT 0,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmailEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VideoOriginal" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VideoPlaybackSession" ALTER COLUMN "sourceKind" DROP NOT NULL,
ALTER COLUMN "maxProgressMs" SET NOT NULL,
ALTER COLUMN "maxProgressMs" SET DEFAULT 0,
ALTER COLUMN "lastHeartbeatAt" DROP NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;
