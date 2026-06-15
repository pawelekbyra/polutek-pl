import { PrismaClient } from '@prisma/client';
import { flags } from '../lib/feature-flags';

async function verifyMainChannel() {
  const prisma = new PrismaClient();
  const slug = process.env.MAIN_CREATOR_SLUG || 'polutek';

  console.log(`--- Verifying Main Channel: ${slug} ---`);

  try {
    const channel = await prisma.creator.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        isApproved: true,
        isPrimary: true,
      }
    });

    if (!channel) {
      console.error(`❌ ERROR: Main channel with slug "${slug}" not found.`);
      process.exit(1);
    }

    console.log(`✓ Channel found: ${channel.name} (${channel.id})`);

    if (channel.isApproved) {
      console.log(`✓ Channel is approved.`);
    } else {
      console.warn(`⚠️ WARNING: Channel is NOT approved.`);
    }

    if (channel.isPrimary) {
      console.log(`✓ Channel is primary.`);
    } else {
      console.warn(`⚠️ WARNING: Channel is NOT primary.`);
    }

    if (channel.isApproved && channel.isPrimary) {
      console.log(`\n🚀 MAIN CHANNEL CONFIGURATION LOOKS GOOD.`);
    } else {
      console.error(`\n❌ ERROR: Main channel must be approved AND primary for normal operation.`);
      process.exit(1);
    }

  } catch (err: any) {
    if (err.code === 'P1001') {
      console.error(`❌ ERROR: Could not connect to database to verify channel.`);
    } else {
      console.error(`❌ ERROR: Unexpected error during verification:`, err);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMainChannel();
