import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  console.log("=== KOMPLEKSOWA NAPRAWA SCHEMATU BAZY DANYCH (v2) ===");

  const commands = [
    // 1. Enums
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VideoStatus') THEN
         CREATE TYPE "VideoStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNLISTED', 'ARCHIVED');
       END IF;
     END $$;`,

    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccessTier') THEN
         CREATE TYPE "AccessTier" AS ENUM ('PUBLIC', 'LOGGED_IN', 'PATRON');
       END IF;
     END $$;`,

    // 2. User table
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralPoints" INTEGER DEFAULT 0;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCount" INTEGER DEFAULT 0;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'USER';`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT DEFAULT 'en';`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPatron" BOOLEAN DEFAULT false;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patronSince" TIMESTAMP(3);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN DEFAULT false;`,

    // 3. Video table (CRITICAL FIX)
    `ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "status" "VideoStatus" NOT NULL DEFAULT 'DRAFT';`,
    `ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);`,
    `ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "isMainFeatured" BOOLEAN DEFAULT false;`,
    `ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "tier" "AccessTier" NOT NULL DEFAULT 'PUBLIC';`,
    `ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "duration" TEXT;`,
    `ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "views" INTEGER DEFAULT 0;`,
    `ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "likesCount" INTEGER DEFAULT 0;`,
    `ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "dislikesCount" INTEGER DEFAULT 0;`,

    // 4. Creator table
    `ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN DEFAULT false;`,
    `ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN DEFAULT false;`,
    `ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "subscribersCount" INTEGER DEFAULT 0;`,

    // 6. New Tables
    `CREATE TABLE IF NOT EXISTS "ClerkEvent" (
        "id" TEXT PRIMARY KEY,
        "type" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PROCESSING',
        "payload" JSONB,
        "error" TEXT,
        "processedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
    );`,

    // 7. Indexes
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");`
  ];

  for (const cmd of commands) {
    try {
      const shortCmd = cmd.trim().split('\n')[0].substring(0, 60);
      process.stdout.write(`Executing: ${shortCmd}... `);
      await prisma.$executeRawUnsafe(cmd);
      console.log("OK.");
    } catch (err: any) {
      if (err.message?.includes("already exists") || err.message?.includes("enum label")) {
        console.log("Already exists/Compatible.");
      } else {
        console.log("ERROR.");
        console.error("   Detail:", err.message);
      }
    }
  }

  console.log("\n--- BACKFILL & DATA RECOVERY ---");
  try {
      // Approve default channel
      await prisma.creator.updateMany({
          where: { slug: 'polutek' },
          data: { isApproved: true, isPrimary: true }
      });
      console.log("Twórca 'polutek' zatwierdzony.");

      // Fix legacy content visibility
      const result = await prisma.video.updateMany({
          where: { status: 'PUBLISHED' as any, publishedAt: null },
          data: { publishedAt: new Date() }
      });
      console.log(`Poprawiono daty publikacji dla ${result.count} filmów.`);

      // Ensure all users have a referral code
      await prisma.$executeRawUnsafe(`UPDATE "User" SET "referralCode" = substring(md5(random()::text), 1, 8) WHERE "referralCode" IS NULL;`);
      console.log("Kody polecające wygenerowane.");

  } catch (e: any) {
      console.log("Błąd przy backfillu danych:", e.message);
  }

  console.log("\n=== KONIEC NAPRAWY SCHEMATU ===");
  await prisma.$disconnect();
}

fix();
