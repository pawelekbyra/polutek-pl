import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("--- DB SCHEMA INSPECTION ---");
  try {
    const result = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'Video'`;
    console.log("Columns in Video table:", result);
  } catch (e: any) {
    console.error("Error inspecting schema:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
