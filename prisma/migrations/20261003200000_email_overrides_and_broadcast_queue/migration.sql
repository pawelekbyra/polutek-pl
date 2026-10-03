-- Email subsystem (2026-10-03): template overrides, durable broadcast queue, consent default.
-- Additive and idempotent: new nullable columns, new indexes, a column default and a backfill.

-- 1. EmailTemplate.customizedAt: a system template row is used for sending only when an admin saved it.
ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "customizedAt" TIMESTAMP(3);

-- Backfill. Rows were seeded on every app start (instrumentation.ts) with create-only writes, so a
-- system row whose updatedAt is later than its createdAt was saved by an admin afterwards. Seeded,
-- never-edited system rows stay NULL: from now on the default in lib/email-defaults.ts is sent for
-- them. Non-system rows are always admin-made templates.
UPDATE "EmailTemplate"
SET "customizedAt" = "updatedAt"
WHERE "customizedAt" IS NULL
  AND ("isSystem" = false OR "updatedAt" > "createdAt" + interval '5 seconds');

-- 2. Broadcast queue: idempotency key of the send request, lease of the sending cron run, backoff.
ALTER TABLE "BroadcastEmail" ADD COLUMN IF NOT EXISTS "requestKey" TEXT;
ALTER TABLE "BroadcastEmail" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "BroadcastEmail" ADD COLUMN IF NOT EXISTS "nextRunAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "BroadcastEmail_requestKey_key" ON "BroadcastEmail"("requestKey");

ALTER TABLE "BroadcastEmailRecipient" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BroadcastEmailRecipient" ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "BroadcastEmailRecipient_broadcastEmailId_status_idx" ON "BroadcastEmailRecipient"("broadcastEmailId", "status");
CREATE INDEX IF NOT EXISTS "BroadcastEmailRecipient_resendEmailId_idx" ON "BroadcastEmailRecipient"("resendEmailId");

-- 3. No consent unless it was explicitly given (every code path already writes the value explicitly).
ALTER TABLE "EmailPreference" ALTER COLUMN "marketingEmails" SET DEFAULT false;
