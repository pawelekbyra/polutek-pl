-- Add idempotency request id used by checkout create-intent.
-- This is intentionally safe to run on production where the column may already exist.

ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "requestId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_userId_requestId_key"
ON "Payment" ("userId", "requestId");
