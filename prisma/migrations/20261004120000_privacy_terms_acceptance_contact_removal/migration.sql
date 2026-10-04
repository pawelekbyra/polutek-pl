-- Privacy compliance (2026-10-04). Additive and idempotent: two nullable columns and one new table.

-- 1. Which version of the Terms a user accepted, and when (sign-up, and again with a tip).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;

-- 2. Resend Audience contacts still to be removed after an account deletion (retried by /api/cron/retention).
CREATE TABLE IF NOT EXISTS "ResendContactRemoval" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResendContactRemoval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResendContactRemoval_email_key" ON "ResendContactRemoval"("email");
CREATE INDEX IF NOT EXISTS "ResendContactRemoval_nextAttemptAt_idx" ON "ResendContactRemoval"("nextAttemptAt");
