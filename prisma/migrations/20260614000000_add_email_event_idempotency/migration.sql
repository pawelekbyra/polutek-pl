-- AlterTable
ALTER TABLE "EmailEvent" ADD COLUMN     "error" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "providerEventId" TEXT,
ADD COLUMN     "status" "WebhookEventStatus" NOT NULL DEFAULT 'PROCESSED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "EmailEvent_providerEventId_key" ON "EmailEvent"("providerEventId");
