ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "requestId" TEXT;

UPDATE "Payment"
SET "requestId" = "metadata"->>'requestId'
WHERE "requestId" IS NULL
  AND "metadata" IS NOT NULL
  AND jsonb_typeof("metadata"::jsonb) = 'object'
  AND "metadata"::jsonb ? 'requestId';

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_userId_requestId_key" ON "Payment"("userId", "requestId");
