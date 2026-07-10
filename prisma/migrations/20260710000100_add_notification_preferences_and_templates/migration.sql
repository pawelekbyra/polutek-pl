-- Per-user opt-out toggles for non-essential notification categories.
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "patronEnabled" BOOLEAN NOT NULL DEFAULT true,
    "commentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "systemEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_userId_key" UNIQUE ("userId"),
    CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Admin-editable overrides for standard notification copy, keyed by kind.
CREATE TABLE "NotificationTemplate" (
    "kind" "NotificationKind" NOT NULL PRIMARY KEY,
    "titlePl" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyPl" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT
);
