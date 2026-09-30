-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorType" TEXT,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "systemReason" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "PatronGrant" ADD COLUMN     "revokeReason" TEXT,
ADD COLUMN     "revokedById" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "refundedById" TEXT;
