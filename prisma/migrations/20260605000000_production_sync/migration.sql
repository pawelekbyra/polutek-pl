-- 1. Create WebhookEventStatus enum
DO $$ BEGIN
    CREATE TYPE "WebhookEventStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update PaymentStatus enum
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CHARGEBACK_LOST';

-- 2.1 Update VideoStatus enum
ALTER TYPE "VideoStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- 3. Update PatronGrantSource enum
ALTER TYPE "PatronGrantSource" ADD VALUE IF NOT EXISTS 'STRIPE_TIP';
ALTER TYPE "PatronGrantSource" ADD VALUE IF NOT EXISTS 'MIGRATION';

-- 4. Fix StripeEvent table status column
-- First, check if status column uses StripeEventStatus and migrate it to WebhookEventStatus if necessary
DO $$
DECLARE
    status_type text;
BEGIN
    SELECT udt_name INTO status_type
    FROM information_schema.columns
    WHERE table_name = 'StripeEvent' AND column_name = 'status';

    IF status_type = 'StripeEventStatus' THEN
        ALTER TABLE "StripeEvent" ALTER COLUMN "status" TYPE TEXT;
        ALTER TABLE "StripeEvent" ALTER COLUMN "status" TYPE "WebhookEventStatus" USING "status"::"WebhookEventStatus";
        DROP TYPE "StripeEventStatus";
    END IF;
END $$;

-- 5. Create ClerkEvent table
CREATE TABLE IF NOT EXISTS "ClerkEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PROCESSING',
    "payload" JSONB,
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClerkEvent_pkey" PRIMARY KEY ("id")
);

-- 6. Add missing columns to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patronSource" "PatronGrantSource";

-- 7. Add missing columns to Video
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "titleEn" TEXT;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "showInSidebar" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "sidebarOrder" INTEGER NOT NULL DEFAULT 0;

-- 8. Add missing columns to Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedAmountMinor" INTEGER NOT NULL DEFAULT 0;

-- 9. Add missing columns to EmailTemplate
ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "subjectEn" TEXT;
ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "htmlEn" TEXT;

-- 10. Fix unique constraints on PatronGrant
-- Drop old indices if they exist (they might not be unique)
DROP INDEX IF EXISTS "PatronGrant_paymentId_idx";
-- Create unique indices
CREATE UNIQUE INDEX IF NOT EXISTS "PatronGrant_paymentId_key" ON "PatronGrant"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "PatronGrant_referralId_key" ON "PatronGrant"("referralId");
