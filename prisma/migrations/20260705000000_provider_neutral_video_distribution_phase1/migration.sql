-- Phase 1 provider-neutral video distribution foundation.
-- This migration is intentionally additive except for converting VideoOriginal.status
-- from TEXT to an enum and removing the old one-original-per-video uniqueness.

-- Create enums
CREATE TYPE "VideoOriginalStatus" AS ENUM ('PROVISIONING', 'UPLOADING', 'UPLOADED', 'VERIFYING', 'READY', 'FAILED', 'SUPERSEDED', 'ABANDONED');
CREATE TYPE "VideoDistributionMode" AS ENUM ('SINGLE_PROVIDER', 'MULTI_PROVIDER', 'AUTO', 'MANUAL');
CREATE TYPE "VideoPlaybackSelectionPolicy" AS ENUM ('MANUAL', 'FIRST_READY', 'PREFER_SELECTED', 'BEST_HEALTH', 'LOWEST_COST');
CREATE TYPE "VideoAutopublishPolicy" AS ENUM ('NEVER', 'WHEN_ANY_TARGET_READY', 'WHEN_ALL_REQUIRED_TARGETS_READY', 'WHEN_ACTIVE_ROUTE_READY');
CREATE TYPE "VideoDistributionTargetStatus" AS ENUM ('REQUESTED', 'QUEUED', 'STARTING', 'WAITING_PROVIDER', 'READY', 'FAILED', 'DISABLED', 'CANCELLED');
CREATE TYPE "VideoDistributionTargetRole" AS ENUM ('PRIMARY', 'BACKUP', 'CANDIDATE');
CREATE TYPE "VideoProviderJobType" AS ENUM ('IMPORT_FROM_ORIGINAL', 'DIRECT_UPLOAD', 'ATTACH_EXISTING', 'SYNC_STATUS', 'DELETE_PROVIDER_ASSET');
CREATE TYPE "VideoProviderJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_PROVIDER', 'READY', 'FAILED', 'CANCELLED', 'ABANDONED');
CREATE TYPE "VideoPlaybackRouteStatus" AS ENUM ('ACTIVE', 'PREVIOUS', 'DISABLED', 'FAILED');
CREATE TYPE "VideoPlaybackRouteActivatedBy" AS ENUM ('ADMIN', 'POLICY', 'FALLBACK', 'MIGRATION', 'RECONCILER');
CREATE TYPE "VideoProviderWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- Convert VideoOriginal into a versioned neutral-original table while preserving existing rows.
DROP INDEX IF EXISTS "VideoOriginal_status_idx";
DROP INDEX IF EXISTS "VideoOriginal_videoId_key";

ALTER TABLE "VideoOriginal"
  ADD COLUMN "storageProvider" "StorageProvider" NOT NULL DEFAULT 'R2',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "supersededAt" TIMESTAMP(3),
  ADD COLUMN "status_new" "VideoOriginalStatus" NOT NULL DEFAULT 'UPLOADING';

UPDATE "VideoOriginal"
SET "status_new" = CASE UPPER("status")
  WHEN 'PROVISIONING' THEN 'PROVISIONING'::"VideoOriginalStatus"
  WHEN 'UPLOADING' THEN 'UPLOADING'::"VideoOriginalStatus"
  WHEN 'UPLOADED' THEN 'UPLOADED'::"VideoOriginalStatus"
  WHEN 'VERIFYING' THEN 'VERIFYING'::"VideoOriginalStatus"
  WHEN 'READY' THEN 'READY'::"VideoOriginalStatus"
  WHEN 'FAILED' THEN 'FAILED'::"VideoOriginalStatus"
  WHEN 'SUPERSEDED' THEN 'SUPERSEDED'::"VideoOriginalStatus"
  WHEN 'ABANDONED' THEN 'ABANDONED'::"VideoOriginalStatus"
  -- Unknown historical values are safest as FAILED: they should not be treated as uploadable/ready.
  ELSE 'FAILED'::"VideoOriginalStatus"
END;

ALTER TABLE "VideoOriginal" DROP COLUMN "status";
ALTER TABLE "VideoOriginal" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "VideoOriginal" ALTER COLUMN "status" SET DEFAULT 'UPLOADING';

-- Add Video active pointers. Foreign keys are added after VideoPlaybackRoute exists.
ALTER TABLE "Video"
  ADD COLUMN "activeOriginalId" TEXT,
  ADD COLUMN "activePlaybackRouteId" TEXT;

-- New distribution foundation tables.
CREATE TABLE "VideoDistributionPlan" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "originalId" TEXT,
  "mode" "VideoDistributionMode" NOT NULL DEFAULT 'SINGLE_PROVIDER',
  "selectionPolicy" "VideoPlaybackSelectionPolicy" NOT NULL DEFAULT 'PREFER_SELECTED',
  "autopublishPolicy" "VideoAutopublishPolicy" NOT NULL DEFAULT 'NEVER',
  "preferredProvider" "StorageProvider",
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "publishRequestedAt" TIMESTAMP(3),
  "publishCompletedAt" TIMESTAMP(3),
  "publishError" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoDistributionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoDistributionTarget" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "provider" "StorageProvider" NOT NULL,
  "role" "VideoDistributionTargetRole" NOT NULL DEFAULT 'CANDIDATE',
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "VideoDistributionTargetStatus" NOT NULL DEFAULT 'REQUESTED',
  "desiredPrimary" BOOLEAN NOT NULL DEFAULT false,
  "lastError" TEXT,
  "lastStatusAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoDistributionTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoProviderJob" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "planId" TEXT,
  "targetId" TEXT,
  "originalId" TEXT,
  "assetId" TEXT,
  "provider" "StorageProvider" NOT NULL,
  "type" "VideoProviderJobType" NOT NULL,
  "status" "VideoProviderJobStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "idempotencyKey" TEXT,
  "providerAssetId" TEXT,
  "providerPlaybackId" TEXT,
  "providerUploadId" TEXT,
  "lastError" TEXT,
  "lastErrorCode" TEXT,
  "nextAttemptAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastReconciledAt" TIMESTAMP(3),
  "lastWebhookAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoProviderJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoPlaybackRoute" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "planId" TEXT,
  "assetId" TEXT NOT NULL,
  "provider" "StorageProvider" NOT NULL,
  "status" "VideoPlaybackRouteStatus" NOT NULL DEFAULT 'ACTIVE',
  "activatedBy" "VideoPlaybackRouteActivatedBy" NOT NULL DEFAULT 'POLICY',
  "activationReason" TEXT,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deactivatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoPlaybackRoute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoProviderWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" "StorageProvider" NOT NULL,
  "externalEventId" TEXT,
  "eventType" TEXT NOT NULL,
  "providerAssetId" TEXT,
  "providerUploadId" TEXT,
  "status" "VideoProviderWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  "payload" JSONB NOT NULL,
  CONSTRAINT "VideoProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- VideoAsset additive link to requested distribution target.
ALTER TABLE "VideoAsset" ADD COLUMN "distributionTargetId" TEXT;

-- Backfill the active original pointer from the previous one-original-per-video model.
UPDATE "Video" v
SET "activeOriginalId" = vo."id"
FROM "VideoOriginal" vo
WHERE vo."videoId" = v."id"
  AND v."activeOriginalId" IS NULL;

-- Unique constraints and indexes.
CREATE UNIQUE INDEX "Video_activeOriginalId_key" ON "Video"("activeOriginalId");
CREATE UNIQUE INDEX "Video_activePlaybackRouteId_key" ON "Video"("activePlaybackRouteId");
CREATE UNIQUE INDEX "VideoOriginal_videoId_version_key" ON "VideoOriginal"("videoId", "version");
CREATE UNIQUE INDEX "VideoDistributionTarget_planId_provider_key" ON "VideoDistributionTarget"("planId", "provider");
CREATE UNIQUE INDEX "VideoProviderJob_idempotencyKey_key" ON "VideoProviderJob"("idempotencyKey");
CREATE UNIQUE INDEX "VideoProviderWebhookEvent_provider_externalEventId_key" ON "VideoProviderWebhookEvent"("provider", "externalEventId");

CREATE INDEX "Video_activeOriginalId_idx" ON "Video"("activeOriginalId");
CREATE INDEX "Video_activePlaybackRouteId_idx" ON "Video"("activePlaybackRouteId");
CREATE INDEX "VideoAsset_distributionTargetId_idx" ON "VideoAsset"("distributionTargetId");
CREATE INDEX "VideoOriginal_videoId_version_idx" ON "VideoOriginal"("videoId", "version");
CREATE INDEX "VideoOriginal_status_idx" ON "VideoOriginal"("status");
CREATE INDEX "VideoDistributionPlan_videoId_isActive_idx" ON "VideoDistributionPlan"("videoId", "isActive");
CREATE INDEX "VideoDistributionPlan_originalId_idx" ON "VideoDistributionPlan"("originalId");
CREATE INDEX "VideoDistributionPlan_preferredProvider_idx" ON "VideoDistributionPlan"("preferredProvider");
CREATE INDEX "VideoDistributionTarget_planId_idx" ON "VideoDistributionTarget"("planId");
CREATE INDEX "VideoDistributionTarget_videoId_idx" ON "VideoDistributionTarget"("videoId");
CREATE INDEX "VideoDistributionTarget_provider_idx" ON "VideoDistributionTarget"("provider");
CREATE INDEX "VideoDistributionTarget_status_idx" ON "VideoDistributionTarget"("status");
CREATE INDEX "VideoProviderJob_videoId_idx" ON "VideoProviderJob"("videoId");
CREATE INDEX "VideoProviderJob_planId_idx" ON "VideoProviderJob"("planId");
CREATE INDEX "VideoProviderJob_targetId_idx" ON "VideoProviderJob"("targetId");
CREATE INDEX "VideoProviderJob_originalId_idx" ON "VideoProviderJob"("originalId");
CREATE INDEX "VideoProviderJob_assetId_idx" ON "VideoProviderJob"("assetId");
CREATE INDEX "VideoProviderJob_provider_providerAssetId_idx" ON "VideoProviderJob"("provider", "providerAssetId");
CREATE INDEX "VideoProviderJob_providerUploadId_idx" ON "VideoProviderJob"("providerUploadId");
CREATE INDEX "VideoProviderJob_status_nextAttemptAt_idx" ON "VideoProviderJob"("status", "nextAttemptAt");
CREATE INDEX "VideoPlaybackRoute_videoId_status_idx" ON "VideoPlaybackRoute"("videoId", "status");
CREATE INDEX "VideoPlaybackRoute_assetId_idx" ON "VideoPlaybackRoute"("assetId");
CREATE INDEX "VideoPlaybackRoute_provider_idx" ON "VideoPlaybackRoute"("provider");
CREATE INDEX "VideoProviderWebhookEvent_provider_idx" ON "VideoProviderWebhookEvent"("provider");
CREATE INDEX "VideoProviderWebhookEvent_eventType_idx" ON "VideoProviderWebhookEvent"("eventType");
CREATE INDEX "VideoProviderWebhookEvent_providerAssetId_idx" ON "VideoProviderWebhookEvent"("providerAssetId");
CREATE INDEX "VideoProviderWebhookEvent_providerUploadId_idx" ON "VideoProviderWebhookEvent"("providerUploadId");
CREATE INDEX "VideoProviderWebhookEvent_status_idx" ON "VideoProviderWebhookEvent"("status");

-- Foreign keys.
ALTER TABLE "Video" ADD CONSTRAINT "Video_activeOriginalId_fkey"
  FOREIGN KEY ("activeOriginalId") REFERENCES "VideoOriginal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Video" ADD CONSTRAINT "Video_activePlaybackRouteId_fkey"
  FOREIGN KEY ("activePlaybackRouteId") REFERENCES "VideoPlaybackRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_distributionTargetId_fkey"
  FOREIGN KEY ("distributionTargetId") REFERENCES "VideoDistributionTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoDistributionPlan" ADD CONSTRAINT "VideoDistributionPlan_videoId_fkey"
  FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoDistributionPlan" ADD CONSTRAINT "VideoDistributionPlan_originalId_fkey"
  FOREIGN KEY ("originalId") REFERENCES "VideoOriginal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoDistributionTarget" ADD CONSTRAINT "VideoDistributionTarget_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "VideoDistributionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoProviderJob" ADD CONSTRAINT "VideoProviderJob_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "VideoDistributionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoProviderJob" ADD CONSTRAINT "VideoProviderJob_targetId_fkey"
  FOREIGN KEY ("targetId") REFERENCES "VideoDistributionTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoProviderJob" ADD CONSTRAINT "VideoProviderJob_originalId_fkey"
  FOREIGN KEY ("originalId") REFERENCES "VideoOriginal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoProviderJob" ADD CONSTRAINT "VideoProviderJob_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "VideoAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoPlaybackRoute" ADD CONSTRAINT "VideoPlaybackRoute_videoId_fkey"
  FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoPlaybackRoute" ADD CONSTRAINT "VideoPlaybackRoute_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "VideoDistributionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoPlaybackRoute" ADD CONSTRAINT "VideoPlaybackRoute_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "VideoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
