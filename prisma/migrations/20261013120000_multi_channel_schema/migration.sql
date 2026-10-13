-- Multi-creator platform, stage 2: channels, members, handles, quotas, reports, moderation decisions (additive).
-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'LIMITED', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "ChannelRole" AS ENUM ('OWNER', 'MANAGER', 'EDITOR', 'MODERATOR', 'TRANSLATOR');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('VIDEO', 'CHANNEL', 'COMMENT');

-- CreateEnum
CREATE TYPE "ContentReportStatus" AS ENUM ('PENDING', 'DISMISSED', 'ACTION_TAKEN');

-- CreateEnum
CREATE TYPE "VideoModerationStatus" AS ENUM ('VISIBLE', 'AGE_RESTRICTED', 'LIMITED', 'REMOVED');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "channelId" TEXT;

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "deleteAfter" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "handle" TEXT,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "status" "ChannelStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "statusChangedAt" TIMESTAMP(3),
ADD COLUMN     "statusChangedById" TEXT,
ADD COLUMN     "statusReason" TEXT;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "moderationChangedAt" TIMESTAMP(3),
ADD COLUMN     "moderationReason" TEXT,
ADD COLUMN     "moderationStatus" "VideoModerationStatus" NOT NULL DEFAULT 'VISIBLE';

-- AlterTable
ALTER TABLE "VideoEncodeJob" ADD COLUMN     "channelId" TEXT;

-- CreateTable
CREATE TABLE "ChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ChannelRole" NOT NULL,
    "invitedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelHandleHistory" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservedUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelHandleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelQuota" (
    "channelId" TEXT NOT NULL,
    "trustLevel" INTEGER NOT NULL DEFAULT 0,
    "maxStorageBytes" BIGINT NOT NULL,
    "maxUploadBytes" BIGINT NOT NULL,
    "maxVideoSeconds" INTEGER NOT NULL,
    "maxUploadsPerDay" INTEGER NOT NULL,
    "maxQueuedJobs" INTEGER NOT NULL,
    "usedStorageBytes" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelQuota_pkey" PRIMARY KEY ("channelId")
);

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "channelId" TEXT,
    "reporterId" TEXT,
    "reporterEmail" TEXT,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" "ContentReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByAdminId" TEXT,
    "decisionId" TEXT,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationDecision" (
    "id" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "channelId" TEXT,
    "action" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonPublic" TEXT NOT NULL,
    "reasonInternal" TEXT,
    "legalBasis" TEXT,
    "automated" BOOLEAN NOT NULL DEFAULT false,
    "actorAdminId" TEXT,
    "reportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelStrike" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "videoId" TEXT,
    "reason" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "issuedByAdminId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "appealedAt" TIMESTAMP(3),
    "appealNote" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ChannelStrike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelBan" (
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelBan_pkey" PRIMARY KEY ("channelId","userId")
);

-- CreateIndex
CREATE INDEX "ChannelMember_userId_idx" ON "ChannelMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelMember_channelId_userId_key" ON "ChannelMember"("channelId", "userId");

-- CreateIndex
CREATE INDEX "ChannelHandleHistory_handle_reservedUntil_idx" ON "ChannelHandleHistory"("handle", "reservedUntil");

-- CreateIndex
CREATE INDEX "ChannelHandleHistory_channelId_idx" ON "ChannelHandleHistory"("channelId");

-- CreateIndex
CREATE INDEX "ContentReport_status_createdAt_idx" ON "ContentReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContentReport_channelId_idx" ON "ContentReport"("channelId");

-- CreateIndex
CREATE INDEX "ContentReport_targetType_targetId_idx" ON "ContentReport"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationDecision_channelId_createdAt_idx" ON "ModerationDecision"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationDecision_targetType_targetId_idx" ON "ModerationDecision"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ChannelStrike_channelId_expiresAt_idx" ON "ChannelStrike"("channelId", "expiresAt");

-- CreateIndex
CREATE INDEX "ChannelBan_userId_idx" ON "ChannelBan"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_channelId_createdAt_idx" ON "AuditLog"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "VideoEncodeJob_channelId_status_idx" ON "VideoEncodeJob"("channelId", "status");

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelHandleHistory" ADD CONSTRAINT "ChannelHandleHistory_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelQuota" ADD CONSTRAINT "ChannelQuota_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelStrike" ADD CONSTRAINT "ChannelStrike_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelBan" ADD CONSTRAINT "ChannelBan_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelBan" ADD CONSTRAINT "ChannelBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------------------------------
-- Stage 2 of the multi-creator platform (docs/architecture/multi-creator-platform.md). Everything above is additive:
-- new enums, tables and nullable or defaulted columns; no existing column or table is changed or dropped.
-- Everything below is idempotent backfill plus two guards that Prisma cannot express.
-- ---------------------------------------------------------------------------------------------------------------

-- Handle backfill: the slug becomes the handle only where it already satisfies the handle rules
-- (3-30 characters of a-z 0-9 . _ -, starting and ending with a letter or digit) and no other channel
-- has the same slug in another case. Other channels keep a NULL handle until the owner picks one.
UPDATE "Creator" c
SET "handle" = lower(c."slug")
WHERE c."handle" IS NULL
  AND c."slug" ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$'
  AND (SELECT count(*) FROM "Creator" d WHERE lower(d."slug") = lower(c."slug")) = 1;

-- Case-insensitive uniqueness of handles (the column itself is nullable).
CREATE UNIQUE INDEX IF NOT EXISTS "Creator_handle_lower_key" ON "Creator" (lower("handle")) WHERE "handle" IS NOT NULL;

-- Status backfill: a channel that was not approved is not public, which is PENDING_REVIEW in the new model.
UPDATE "Creator"
SET "status" = 'PENDING_REVIEW'
WHERE "isApproved" = false AND "status" = 'ACTIVE' AND "statusChangedAt" IS NULL;

-- Every existing channel gets its owner as an OWNER member.
INSERT INTO "ChannelMember" ("id", "channelId", "userId", "role", "acceptedAt", "createdAt")
SELECT gen_random_uuid()::text, c."id", c."userId", 'OWNER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Creator" c
ON CONFLICT ("channelId", "userId") DO NOTHING;

-- Encode jobs carry their channel for the fair per-channel queue.
UPDATE "VideoEncodeJob" j
SET "channelId" = v."creatorId"
FROM "Video" v
WHERE v."id" = j."videoId" AND j."channelId" IS NULL;

-- ModerationDecision is a statement of reasons (DSA art. 17): immutable once written.
CREATE OR REPLACE FUNCTION "moderation_decision_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ModerationDecision is append-only (% refused)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "moderation_decision_immutable" ON "ModerationDecision";
CREATE TRIGGER "moderation_decision_immutable"
  BEFORE UPDATE OR DELETE ON "ModerationDecision"
  FOR EACH ROW EXECUTE FUNCTION "moderation_decision_immutable"();
