-- CreateTable
CREATE TABLE "BroadcastEmail" (
    "id" TEXT NOT NULL,
    "subjectPl" TEXT NOT NULL,
    "htmlPl" TEXT NOT NULL,
    "subjectEn" TEXT NOT NULL,
    "htmlEn" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',

    CONSTRAINT "BroadcastEmail_pkey" PRIMARY KEY ("id")
);
