import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("--- DB SCHEMA SMOKE CHECK ---");
  try {
    // 1. Check User table
    console.log("Checking User table...");
    await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        isDeleted: true,
      },
    });
    console.log("✓ User table schema is up to date.");

    // 2. Check Video table
    console.log("Checking Video table...");
    await prisma.video.findFirst({
      select: {
        id: true,
        titleEn: true,
        descriptionEn: true,
        status: true,
      },
    });
    console.log("✓ Video table schema is up to date.");

    // 2b. Check UserPaymentTotal table
    console.log("Checking UserPaymentTotal table...");
    await prisma.userPaymentTotal.findFirst({
      select: {
        userId: true,
        currency: true,
        amountMinor: true,
      },
    });
    console.log("✓ UserPaymentTotal table schema is up to date.");

    // 3. Check EmailTemplate table
    console.log("Checking EmailTemplate table...");
    await prisma.emailTemplate.findFirst({
      select: {
        id: true,
        subjectEn: true,
        htmlEn: true,
      },
    });
    console.log("✓ EmailTemplate table schema is up to date.");

    // 4. Check Payment table
    console.log("Checking Payment table...");
    await prisma.payment.findFirst({
      select: {
        id: true,
        refundedAmountMinor: true,
      },
    });
    console.log("✓ Payment table schema is up to date.");

    // 5. Check PatronGrant table unique constraints
    console.log("Checking PatronGrant table...");
    await prisma.patronGrant.findFirst({
        select: {
            id: true,
            paymentId: true,
        }
    });
    console.log("✓ PatronGrant table schema is up to date.");

    // 6. Check StripeEvent table
    console.log("Checking StripeEvent table...");
    await prisma.stripeEvent.findFirst({
      select: {
        id: true,
        status: true,
      },
    });
    console.log("✓ StripeEvent table schema is up to date.");

    console.log("\n🚀 DB SCHEMA HEALTHY: All critical columns and tables exist.");
  } catch (e: any) {
    if (e.message?.includes('Can\'t reach database server')) {
        console.error("\n❌ ERROR: Database server is unreachable!");
        console.error("Please verify your DATABASE_URL and network settings.");
        process.exit(1);
    }
    if (e.code === 'P2022') {
        console.error("\n❌ ERROR: Database schema drift detected!");
        console.error(`Missing column: ${e.meta?.column}`);
        console.error("Run 'npm run db:migrate:deploy' against the active production DATABASE_URL.");
    } else {
        console.error("\n❌ ERROR: Unexpected database error during smoke check:");
        console.error(e);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
