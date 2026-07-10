-- Create NotificationKind enum type
CREATE TYPE "NotificationKind" AS ENUM ('WELCOME', 'SYSTEM', 'COMMENT', 'SUPPORT', 'PATRON');

-- Create Notification table
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "titlePl" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyPl" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
