-- Defensive production drift guard for columns required by the current Prisma schema.
-- This migration is intentionally idempotent so an already-healed database can deploy safely.

DO $$ BEGIN
  CREATE TYPE "PatronGrantSource" AS ENUM ('STRIPE_TIP', 'PAYMENT', 'REFERRAL', 'ADMIN', 'MIGRATION', 'LEGACY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "PatronGrantSource" ADD VALUE IF NOT EXISTS 'STRIPE_TIP';
ALTER TYPE "PatronGrantSource" ADD VALUE IF NOT EXISTS 'PAYMENT';
ALTER TYPE "PatronGrantSource" ADD VALUE IF NOT EXISTS 'REFERRAL';
ALTER TYPE "PatronGrantSource" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "PatronGrantSource" ADD VALUE IF NOT EXISTS 'MIGRATION';
ALTER TYPE "PatronGrantSource" ADD VALUE IF NOT EXISTS 'LEGACY';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPatron" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patronSince" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patronSource" "PatronGrantSource";

ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "titleEn" TEXT;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT;

ALTER TABLE "PatronGrant" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;
ALTER TABLE "PatronGrant" ADD COLUMN IF NOT EXISTS "referralId" TEXT;
ALTER TABLE "PatronGrant" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "PatronGrant" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

WITH duplicate_payment_grants AS (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "paymentId" ORDER BY "createdAt" ASC, id ASC) AS row_num
    FROM "PatronGrant"
    WHERE "paymentId" IS NOT NULL
  ) ranked
  WHERE row_num > 1
)
UPDATE "PatronGrant" pg
SET
  "revokedAt" = COALESCE(pg."revokedAt", NOW()),
  "reason" = CONCAT_WS(' ', NULLIF(pg."reason", ''), '[MIGRATION_DEDUP duplicate paymentId]'),
  "paymentId" = NULL
FROM duplicate_payment_grants d
WHERE pg.id = d.id;

WITH duplicate_referral_grants AS (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "referralId" ORDER BY "createdAt" ASC, id ASC) AS row_num
    FROM "PatronGrant"
    WHERE "referralId" IS NOT NULL
  ) ranked
  WHERE row_num > 1
)
UPDATE "PatronGrant" pg
SET
  "revokedAt" = COALESCE(pg."revokedAt", NOW()),
  "reason" = CONCAT_WS(' ', NULLIF(pg."reason", ''), '[MIGRATION_DEDUP duplicate referralId]'),
  "referralId" = NULL
FROM duplicate_referral_grants d
WHERE pg.id = d.id;

DROP INDEX IF EXISTS "PatronGrant_paymentId_idx";
DROP INDEX IF EXISTS "PatronGrant_referralId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "PatronGrant_paymentId_key" ON "PatronGrant"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "PatronGrant_referralId_key" ON "PatronGrant"("referralId");
