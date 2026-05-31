-- CreateTable
CREATE TABLE "ClerkEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClerkEvent_pkey" PRIMARY KEY ("id")
);

-- AlterEnum
-- Note: PostgreSQL doesn't support adding values to an enum in a transaction in some versions.
-- We'll use a series of ALTER TYPE commands.
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE 'DISPUTED';
ALTER TYPE "PaymentStatus" ADD VALUE 'CHARGEBACK_LOST';
