-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "refundedAmountMinor" INTEGER NOT NULL DEFAULT 0;
-- AlterTable
ALTER TABLE "StripeEvent" ADD COLUMN "processedAt" TIMESTAMP(3);
