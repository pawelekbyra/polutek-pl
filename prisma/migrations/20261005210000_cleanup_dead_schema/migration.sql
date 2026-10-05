-- Cleanup of dead database schema (docs/architecture/db-cleanup-2026-10-05.md; owner decision 2026-10-05:
-- dead tables, columns and enum values may be removed after a backup, once the code stopped using them).
--
-- DESTRUCTIVE and NOT reversible except by restoring the pre-deploy dump. Read the pre-deploy checklist in
-- docs/architecture/db-cleanup-2026-10-05.md BEFORE deploying this migration to production.
--
-- Prisma runs this file as ONE multi-statement query, i.e. in ONE implicit transaction: any failure rolls back
-- everything (no BEGIN/COMMIT here on purpose, like every other migration of this repository). Idempotent: every
-- DROP uses IF EXISTS, every ADD uses IF NOT EXISTS, the data and enum steps are guarded, so a second run is a no-op.
-- Order: data fold, foreign-key columns, tables, enum types, plain columns, type change, enum swap, indexes.
--
-- Evidence (grep over app/ lib/ apps/ scripts/ workers/ services/ prisma/seed.ts tests/ deploy/ and every $queryRaw /
-- $executeRaw, 2026-10-05, after the code of this same change stopped touching them): zero reads and zero writes of
-- every object below. Objects deliberately NOT removed are listed in the docs (notifications, UserPaymentTotal,
-- InboundEmail, Subscription, BroadcastEmail.scheduledAt, StorageProvider values, PatronGrantSource values, ...).
--
-- 1. Data fold: PaymentCurrencySetting.patronBoxMinMinor was a legacy tip-box minimum; until an admin saved the
--    setting the effective minimum was max(minAmountMinor, patronBoxMinMinor). The value is folded into
--    minAmountMinor first, so the minimum users see does not change when the column goes away.
-- 2. Tables (all unused since the removal of the third-party video providers 2026-10-02 / Clerk 2026-10-02 / the
--    comment reaction rewrite): VideoProviderJob, VideoDistributionTarget, VideoDistributionPlan,
--    VideoProviderWebhookEvent, ClerkEvent (old webhook payloads with personal data), CommentLike, CommentDislike.
-- 3. Enum types of those tables: VideoDistributionMode, VideoPlaybackSelectionPolicy, VideoAutopublishPolicy,
--    VideoDistributionTargetStatus, VideoDistributionTargetRole, VideoProviderJobType, VideoProviderJobStatus,
--    VideoProviderWebhookStatus.
-- 4. Columns: User.totalPaidMinor, User.canCreateChannel, Creator.bannerUrl (cover removed 2026-10-04),
--    Creator.stripeConnectId, Comment.score, Comment.pinnedById, Video.videoUrl, Video.publishAfterAssetReadyProvider,
--    VideoOriginal.storageProvider, VideoOriginal.checksumSha256, VideoAsset.{distributionTargetId, providerAssetId,
--    providerPlaybackId, externalVideoId, externalUrl, muxUploadId, pendingPrimaryIntent, providerSyncedAt,
--    processingStartedAt, fallbackPriority, mirrorSourceOriginalId, mirrorRequestedAt, mirrorCompletedAt,
--    mirrorFailureReason}, VideoPlaybackRoute.planId, VideoPlaybackSession.endedAt, EmailPreference.resendContactId,
--    BroadcastEmail.templateId, PaymentCurrencySetting.{patronThresholdMinor, patronBoxMinMinor}.
--    Indexes and foreign keys on these columns go with them.
-- 5. VideoAsset.sizeBytes INTEGER -> BIGINT (an HLS tree above 2 GiB was stored as NULL).
-- 6. AccessTier loses PATRON (Postgres has no DROP VALUE: new type, rows mapped to LOGGED_IN, old type dropped).
--    Video.tier was already moved by 20261004230000; VideoPlaybackSession.accessTier keeps history, PATRON becomes
--    LOGGED_IN (the two behaved identically).
-- 7. Missing indexes: Comment(authorId), VideoPlaybackSession(countedAsView, startedAt), Payment(status, createdAt).

-- 1. Data fold (guarded: the column may already be gone on a second run).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'PaymentCurrencySetting' AND column_name = 'patronBoxMinMinor'
  ) THEN
    UPDATE "PaymentCurrencySetting"
       SET "minAmountMinor" = GREATEST("minAmountMinor", "patronBoxMinMinor")
     WHERE "patronBoxMinMinor" IS NOT NULL AND "patronBoxMinMinor" > "minAmountMinor";
  END IF;
END $$;

-- 2a. Columns that hold foreign keys into the tables below (DROP COLUMN removes the constraint and its indexes).
ALTER TABLE "VideoAsset"
  DROP COLUMN IF EXISTS "distributionTargetId",
  DROP COLUMN IF EXISTS "providerAssetId",
  DROP COLUMN IF EXISTS "providerPlaybackId",
  DROP COLUMN IF EXISTS "externalVideoId",
  DROP COLUMN IF EXISTS "externalUrl",
  DROP COLUMN IF EXISTS "muxUploadId",
  DROP COLUMN IF EXISTS "pendingPrimaryIntent",
  DROP COLUMN IF EXISTS "providerSyncedAt",
  DROP COLUMN IF EXISTS "processingStartedAt",
  DROP COLUMN IF EXISTS "fallbackPriority",
  DROP COLUMN IF EXISTS "mirrorSourceOriginalId",
  DROP COLUMN IF EXISTS "mirrorRequestedAt",
  DROP COLUMN IF EXISTS "mirrorCompletedAt",
  DROP COLUMN IF EXISTS "mirrorFailureReason";
ALTER TABLE "VideoPlaybackRoute" DROP COLUMN IF EXISTS "planId";

-- 2b. Tables, children first (no CASCADE on purpose: an unexpected dependent object must fail the migration).
DROP TABLE IF EXISTS "VideoProviderJob";
DROP TABLE IF EXISTS "VideoDistributionTarget";
DROP TABLE IF EXISTS "VideoDistributionPlan";
DROP TABLE IF EXISTS "VideoProviderWebhookEvent";
DROP TABLE IF EXISTS "ClerkEvent";
DROP TABLE IF EXISTS "CommentLike";
DROP TABLE IF EXISTS "CommentDislike";

-- 3. Enum types, after the tables that used them.
DROP TYPE IF EXISTS "VideoDistributionMode";
DROP TYPE IF EXISTS "VideoPlaybackSelectionPolicy";
DROP TYPE IF EXISTS "VideoAutopublishPolicy";
DROP TYPE IF EXISTS "VideoDistributionTargetStatus";
DROP TYPE IF EXISTS "VideoDistributionTargetRole";
DROP TYPE IF EXISTS "VideoProviderJobType";
DROP TYPE IF EXISTS "VideoProviderJobStatus";
DROP TYPE IF EXISTS "VideoProviderWebhookStatus";

-- 4. Plain columns.
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "totalPaidMinor",
  DROP COLUMN IF EXISTS "canCreateChannel";
ALTER TABLE "Creator"
  DROP COLUMN IF EXISTS "bannerUrl",
  DROP COLUMN IF EXISTS "stripeConnectId";
ALTER TABLE "Comment"
  DROP COLUMN IF EXISTS "score",
  DROP COLUMN IF EXISTS "pinnedById";
ALTER TABLE "Video"
  DROP COLUMN IF EXISTS "videoUrl",
  DROP COLUMN IF EXISTS "publishAfterAssetReadyProvider";
ALTER TABLE "VideoOriginal"
  DROP COLUMN IF EXISTS "storageProvider",
  DROP COLUMN IF EXISTS "checksumSha256";
ALTER TABLE "VideoPlaybackSession" DROP COLUMN IF EXISTS "endedAt";
ALTER TABLE "EmailPreference" DROP COLUMN IF EXISTS "resendContactId";
ALTER TABLE "BroadcastEmail" DROP COLUMN IF EXISTS "templateId";
ALTER TABLE "PaymentCurrencySetting"
  DROP COLUMN IF EXISTS "patronThresholdMinor",
  DROP COLUMN IF EXISTS "patronBoxMinMinor";

-- 5. Type change (a no-op when the column is already BIGINT).
ALTER TABLE "VideoAsset" ALTER COLUMN "sizeBytes" TYPE BIGINT;

-- 6. AccessTier without PATRON (guarded: only while the old value still exists).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AccessTier' AND e.enumlabel = 'PATRON'
  ) THEN
    UPDATE "Video" SET "tier" = 'LOGGED_IN' WHERE "tier" = 'PATRON';
    UPDATE "VideoPlaybackSession" SET "accessTier" = 'LOGGED_IN' WHERE "accessTier" = 'PATRON';
    CREATE TYPE "AccessTier_new" AS ENUM ('PUBLIC', 'LOGGED_IN');
    ALTER TABLE "Video" ALTER COLUMN "tier" DROP DEFAULT;
    ALTER TABLE "Video" ALTER COLUMN "tier" TYPE "AccessTier_new" USING ("tier"::text::"AccessTier_new");
    ALTER TABLE "VideoPlaybackSession" ALTER COLUMN "accessTier" TYPE "AccessTier_new" USING ("accessTier"::text::"AccessTier_new");
    ALTER TABLE "Video" ALTER COLUMN "tier" SET DEFAULT 'PUBLIC';
    DROP TYPE "AccessTier";
    ALTER TYPE "AccessTier_new" RENAME TO "AccessTier";
  END IF;
END $$;

-- 7. Missing indexes (names follow the Prisma convention, so `prisma migrate diff` stays empty).
CREATE INDEX IF NOT EXISTS "Comment_authorId_idx" ON "Comment"("authorId");
CREATE INDEX IF NOT EXISTS "VideoPlaybackSession_countedAsView_startedAt_idx" ON "VideoPlaybackSession"("countedAsView", "startedAt");
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
