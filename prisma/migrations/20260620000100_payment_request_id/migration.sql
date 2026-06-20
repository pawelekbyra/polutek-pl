-- Add explicit checkout request idempotency key for local Payment records.
ALTER TABLE "Payment" ADD COLUMN "requestId" TEXT;

CREATE UNIQUE INDEX "Payment_requestId_key" ON "Payment"("requestId");
CREATE INDEX "Payment_userId_requestId_idx" ON "Payment"("userId", "requestId");
