import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  console.log("--- MANUAL DB SCHEMA FIX START ---");
  const commands = [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCount" INTEGER DEFAULT 0;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralPoints" INTEGER DEFAULT 0;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalPaid" DOUBLE PRECISION DEFAULT 0;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN DEFAULT false;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'USER';`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT DEFAULT 'en';`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPatron" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patronSince" TIMESTAMP(3);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");`,
    `DO $$
     BEGIN
       IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='preferredLanguage') THEN
         UPDATE "User" SET "language" = "preferredLanguage" WHERE "language" = 'en' AND "preferredLanguage" IS NOT NULL;
       END IF;
       UPDATE "User" SET "referralCode" = substring(md5(random()::text), 1, 8) WHERE "referralCode" IS NULL;
     END $$;`
  ];

  for (const cmd of commands) {
    try {
      console.log(`Executing: ${cmd.substring(0, 50)}...`);
      await prisma.$executeRawUnsafe(cmd);
      console.log("Success.");
    } catch (err: any) {
      if (!err.message?.includes("already exists")) {
        console.error("Error executing command:", err.message);
      } else {
        console.log("Already exists, skipping.");
      }
    }
  }

  console.log("--- MANUAL DB SCHEMA FIX END ---");
  await prisma.$disconnect();
}

fix();
