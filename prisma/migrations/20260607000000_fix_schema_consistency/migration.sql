-- CreateEnum
CREATE TYPE "EmailTemplateCategory" AS ENUM ('SYSTEM', 'WELCOME', 'PAYMENT', 'PATRON', 'BROADCAST', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'READY', 'SENDING', 'SENT', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BroadcastRecipientGroup" AS ENUM ('ALL', 'SUBSCRIBERS', 'PATRONS', 'MANUAL');

-- CreateEnum
CREATE TYPE "BroadcastRecipientStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'SKIPPED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "InboundEmailStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED', 'RESOLVED');

-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "category" "EmailTemplateCategory" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Use a temporary value for slug if it doesn't exist, as it's unique
UPDATE "EmailTemplate" SET "slug" = "id" WHERE "slug" IS NULL;
ALTER TABLE "EmailTemplate" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_slug_key" ON "EmailTemplate"("slug");

-- CreateTable
CREATE TABLE IF NOT EXISTS "BroadcastEmailRecipient" (
    "id" TEXT NOT NULL,
    "broadcastEmailId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pl',
    "status" "BroadcastRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "resendEmailId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastEmailRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmailPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT true,
    "systemEmails" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribedAt" TIMESTAMP(3),
    "resendContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InboundEmail" (
    "id" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT,
    "text" TEXT,
    "html" TEXT,
    "resendId" TEXT NOT NULL,
    "status" "InboundEmailStatus" NOT NULL DEFAULT 'NEW',
    "userId" TEXT,
    "broadcastEmailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmailEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "resendEmailId" TEXT,
    "broadcastEmailId" TEXT,
    "recipientId" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VideoPlaybackSession" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "sourceKind" TEXT NOT NULL,
    "accessTier" "AccessTier" NOT NULL,
    "countedAsView" BOOLEAN NOT NULL DEFAULT false,
    "isAdminPreview" BOOLEAN NOT NULL DEFAULT false,
    "totalWatchMs" INTEGER NOT NULL DEFAULT 0,
    "maxProgressMs" INTEGER,
    "durationMs" INTEGER,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoPlaybackSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VideoPlaybackEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "videoId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "positionMs" INTEGER,
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoPlaybackEvent_pkey" PRIMARY KEY ("id")
);

-- Update BroadcastEmail table to match current schema
ALTER TABLE "BroadcastEmail" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
ALTER TABLE "BroadcastEmail" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "BroadcastEmail" ADD COLUMN IF NOT EXISTS "recipientGroup" "BroadcastRecipientGroup" NOT NULL DEFAULT 'SUBSCRIBERS';
ALTER TABLE "BroadcastEmail" ADD COLUMN IF NOT EXISTS "sentCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BroadcastEmail" ADD COLUMN IF NOT EXISTS "errorCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BroadcastEmail" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "BroadcastEmail" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "BroadcastEmail" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Re-sync status type for BroadcastEmail if it was TEXT
DO $$
BEGIN
    ALTER TABLE "BroadcastEmail" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "BroadcastEmail" ALTER COLUMN "status" TYPE "BroadcastStatus" USING "status"::"BroadcastStatus";
    ALTER TABLE "BroadcastEmail" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BroadcastEmail_status_idx" ON "BroadcastEmail"("status");
CREATE INDEX IF NOT EXISTS "BroadcastEmail_createdAt_idx" ON "BroadcastEmail"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BroadcastEmailRecipient_broadcastEmailId_idx" ON "BroadcastEmailRecipient"("broadcastEmailId");
CREATE INDEX IF NOT EXISTS "BroadcastEmailRecipient_email_idx" ON "BroadcastEmailRecipient"("email");
CREATE INDEX IF NOT EXISTS "BroadcastEmailRecipient_status_idx" ON "BroadcastEmailRecipient"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmailPreference_userId_key" ON "EmailPreference"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "EmailPreference_email_key" ON "EmailPreference"("email");
CREATE INDEX IF NOT EXISTS "EmailPreference_email_idx" ON "EmailPreference"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InboundEmail_resendId_key" ON "InboundEmail"("resendId");
CREATE INDEX IF NOT EXISTS "InboundEmail_fromEmail_idx" ON "InboundEmail"("fromEmail");
CREATE INDEX IF NOT EXISTS "InboundEmail_status_idx" ON "InboundEmail"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailEvent_resendEmailId_idx" ON "EmailEvent"("resendEmailId");
CREATE INDEX IF NOT EXISTS "EmailEvent_broadcastEmailId_idx" ON "EmailEvent"("broadcastEmailId");
CREATE INDEX IF NOT EXISTS "EmailEvent_email_idx" ON "EmailEvent"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VideoPlaybackSession_videoId_idx" ON "VideoPlaybackSession"("videoId");
CREATE INDEX IF NOT EXISTS "VideoPlaybackSession_userId_idx" ON "VideoPlaybackSession"("userId");
CREATE INDEX IF NOT EXISTS "VideoPlaybackSession_createdAt_idx" ON "VideoPlaybackSession"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VideoPlaybackEvent_sessionId_idx" ON "VideoPlaybackEvent"("sessionId");
CREATE INDEX IF NOT EXISTS "VideoPlaybackEvent_videoId_idx" ON "VideoPlaybackEvent"("videoId");
CREATE INDEX IF NOT EXISTS "VideoPlaybackEvent_type_idx" ON "VideoPlaybackEvent"("type");
CREATE INDEX IF NOT EXISTS "VideoPlaybackEvent_createdAt_idx" ON "VideoPlaybackEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "BroadcastEmail" ADD CONSTRAINT "BroadcastEmail_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastEmailRecipient" ADD CONSTRAINT "BroadcastEmailRecipient_broadcastEmailId_fkey" FOREIGN KEY ("broadcastEmailId") REFERENCES "BroadcastEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoPlaybackSession" ADD CONSTRAINT "VideoPlaybackSession_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoPlaybackEvent" ADD CONSTRAINT "VideoPlaybackEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VideoPlaybackSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoPlaybackEvent" ADD CONSTRAINT "VideoPlaybackEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
