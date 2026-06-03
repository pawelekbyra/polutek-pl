import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Adding multi-language support to EmailTemplate table via raw SQL...");
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "subjectEn" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "htmlEn" TEXT;');
    console.log("Columns added successfully.");
  } catch (error) {
    console.error("Error adding columns:", error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
