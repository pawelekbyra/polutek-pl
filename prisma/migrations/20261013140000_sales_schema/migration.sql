-- Sales schema (stage 6): additive only. Nothing here changes behavior while the sales gate is off.
-- Generated with prisma migrate diff, then hand-extended with CHECK constraints and the ledger trigger.

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerEntryKind" AS ENUM ('SALE', 'REFUND', 'PAYOUT', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "AccessTier" ADD VALUE 'PAID';

-- CreateTable
CREATE TABLE "VideoPrice" (
    "videoId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "payWhatYouWant" BOOLEAN NOT NULL DEFAULT false,
    "minAmountMinor" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoPrice_pkey" PRIMARY KEY ("videoId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "grossMinor" INTEGER NOT NULL,
    "vatMinor" INTEGER NOT NULL,
    "netMinor" INTEGER NOT NULL,
    "platformFeeMinor" INTEGER NOT NULL,
    "creatorShareMinor" INTEGER NOT NULL,
    "vatRateBp" INTEGER NOT NULL,
    "feeRateBp" INTEGER NOT NULL,
    "refundedMinor" INTEGER NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "orderId" TEXT,
    "kind" "LedgerEntryKind" NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_providerRef_key" ON "Order"("providerRef");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_channelId_status_idx" ON "Order"("channelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_orderId_key" ON "Entitlement"("orderId");

-- CreateIndex
CREATE INDEX "Entitlement_videoId_idx" ON "Entitlement"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_userId_videoId_key" ON "Entitlement"("userId", "videoId");

-- CreateIndex
CREATE INDEX "LedgerEntry_channelId_availableAt_idx" ON "LedgerEntry"("channelId", "availableAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_orderId_idx" ON "LedgerEntry"("orderId");

-- AddForeignKey
ALTER TABLE "VideoPrice" ADD CONSTRAINT "VideoPrice_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Money sanity at the database level (integer minor units, never negative, the split adds up).
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_check" CHECK (
  "grossMinor" >= 0 AND "vatMinor" >= 0 AND "netMinor" >= 0 AND "platformFeeMinor" >= 0 AND "creatorShareMinor" >= 0
  AND "refundedMinor" >= 0 AND "refundedMinor" <= "grossMinor"
  AND "grossMinor" = "vatMinor" + "netMinor"
  AND "netMinor" = "platformFeeMinor" + "creatorShareMinor"
);
ALTER TABLE "VideoPrice" ADD CONSTRAINT "VideoPrice_amount_check" CHECK (
  "amountMinor" >= 0 AND ("minAmountMinor" IS NULL OR "minAmountMinor" >= 0)
);

-- The ledger is a book: rows are never changed or removed, corrections are new rows.
CREATE OR REPLACE FUNCTION "ledger_entry_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry is append-only (% refused)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ledger_entry_immutable" ON "LedgerEntry";
CREATE TRIGGER "ledger_entry_immutable"
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"();
