-- 1. Create WebhookEventStatus enum defensivley
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WebhookEventStatus') THEN
        CREATE TYPE "WebhookEventStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');
    END IF;
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
        ALTER TABLE "StripeEvent" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "StripeEvent" ALTER COLUMN "status" TYPE TEXT;
        ALTER TABLE "StripeEvent" ALTER COLUMN "status" TYPE "WebhookEventStatus" USING "status"::"WebhookEventStatus";
        ALTER TABLE "StripeEvent" ALTER COLUMN "status" SET DEFAULT 'PROCESSING';
        DROP TYPE IF EXISTS "StripeEventStatus";
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
-- 10.1 Clean duplicates before adding unique constraint (keeping the oldest one)
DELETE FROM "PatronGrant"
WHERE id IN (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "paymentId" ORDER BY "createdAt" ASC) as row_num
        FROM "PatronGrant"
        WHERE "paymentId" IS NOT NULL
    ) t
    WHERE row_num > 1
);

DELETE FROM "PatronGrant"
WHERE id IN (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "referralId" ORDER BY "createdAt" ASC) as row_num
        FROM "PatronGrant"
        WHERE "referralId" IS NOT NULL
    ) t
    WHERE row_num > 1
);

-- 10.2 Drop old redundant indices if they exist
DROP INDEX IF EXISTS "PatronGrant_paymentId_idx";

-- 10.3 Create unique indices
CREATE UNIQUE INDEX IF NOT EXISTS "PatronGrant_paymentId_key" ON "PatronGrant"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "PatronGrant_referralId_key" ON "PatronGrant"("referralId");
