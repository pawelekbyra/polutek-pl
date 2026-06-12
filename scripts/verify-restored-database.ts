import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

/**
 * LAUNCH-OPS-002 — Database backup/restore readiness and safe restoration drill pack
 *
 * This script is for verifying a temporary restored or cloned database.
 * It is strictly READ-ONLY.
 */

async function main() {
  const restoreUrl = process.env.RESTORE_DATABASE_URL;
  const productionUrl = process.env.DATABASE_URL;
  const allowVerification = process.env.ALLOW_RESTORE_VERIFICATION === 'true';
  const manifestPath = process.env.RESTORE_EXPECTED_MANIFEST_PATH;

  console.log("--- RESTORED DATABASE VERIFICATION ---");

  // 1. Safety Checks
  if (!restoreUrl) {
    console.error("ERROR: RESTORE_DATABASE_URL is missing.");
    process.exit(1);
  }

  if (!allowVerification) {
    console.error("ERROR: ALLOW_RESTORE_VERIFICATION=true is required.");
    process.exit(1);
  }

  if (productionUrl && restoreUrl === productionUrl) {
    console.error("ERROR: RESTORE_DATABASE_URL exactly matches DATABASE_URL. Verification refused for safety.");
    process.exit(1);
  }

  // Redacted URL for logging
  const redactedUrl = restoreUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`Target: ${redactedUrl}`);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: restoreUrl,
      },
    },
  });

  try {
    // A. Connectivity
    console.log("\n[A] Connectivity");
    try {
      await prisma.$connect();
      const dbTime = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW() as now`;
      console.log(`✓ Reachable. Server time: ${dbTime[0].now.toISOString()}`);
    } catch (e: any) {
      console.error(`❌ Connection failed: ${e.message}`);
      process.exit(1);
    }

    // B. Migration/schema state
    console.log("\n[B] Migration/Schema State");
    try {
      const migrations = await prisma.$queryRaw<any[]>`SELECT * FROM _prisma_migrations`;
      const failedMigrations = migrations.filter(m => m.rolled_back_at !== null || m.logs !== null);
      console.log(`✓ _prisma_migrations accessible. Count: ${migrations.length}`);
      if (failedMigrations.length > 0) {
        console.error(`❌ Detected ${failedMigrations.length} failed or unfinished migrations!`);
        process.exit(1);
      }
    } catch (e: any) {
      console.warn(`! Unable to access _prisma_migrations: ${e.message}`);
    }

    // C & D. Critical models & Safe aggregates
    console.log("\n[C/D] Model Availability & Safe Aggregates");
    const counts: Record<string, number> = {};

    const checkModel = async (name: string, model: any) => {
      try {
        const count = await model.count();
        counts[name] = count;
        console.log(`✓ ${name}: ${count} rows`);
        return count;
      } catch (e: any) {
        console.error(`❌ ${name} is NOT queryable: ${e.message}`);
        return null;
      }
    };

    await checkModel("User", prisma.user);
    await checkModel("Creator", prisma.creator);
    await checkModel("Video", prisma.video);
    await checkModel("VideoAsset", prisma.videoAsset);
    await checkModel("Payment", prisma.payment);
    await checkModel("UserPaymentTotal", prisma.userPaymentTotal);
    await checkModel("PatronGrant", prisma.patronGrant);
    await checkModel("StripeEvent", prisma.stripeEvent);
    await checkModel("Comment", prisma.comment);
    await checkModel("CommentReport", prisma.commentReport);
    await checkModel("Subscription", prisma.subscription);
    await checkModel("AuditLog", prisma.auditLog);

    // E. Logical Integrity Checks
    console.log("\n[E] Logical Integrity Checks");
    let integrityFailures = 0;

    // 1. PatronGrant referencing missing User
    // We can't use 'is: null' for required relations.
    // Instead we use a manual join check or look for null FKs if they were optional.
    // userId is required in PatronGrant.
    const grants = await prisma.patronGrant.findMany({
      select: { userId: true }
    });
    const userIdsInGrants = Array.from(new Set(grants.map(g => g.userId)));
    const existingUsers = await prisma.user.findMany({
        where: { id: { in: userIdsInGrants } },
        select: { id: true }
    });
    const existingUserIds = new Set(existingUsers.map(u => u.id));
    const missingUsers = userIdsInGrants.filter(id => !existingUserIds.has(id));

    if (missingUsers.length > 0) {
      console.error(`❌ Found PatronGrant(s) referencing ${missingUsers.length} missing User(s)!`);
      integrityFailures++;
    } else {
      console.log("✓ No orphaned PatronGrants detected.");
    }

    // 2. Payment-linked PatronGrant referencing missing Payment
    const grantsWithPayment = await prisma.patronGrant.findMany({
      where: { NOT: { paymentId: null } },
      select: { paymentId: true }
    });
    const paymentIds = grantsWithPayment.map(g => g.paymentId as string);
    const existingPayments = await prisma.payment.findMany({
      where: { id: { in: paymentIds } },
      select: { id: true }
    });
    const existingPaymentIds = new Set(existingPayments.map(p => p.id));
    const missingPayments = paymentIds.filter(id => !existingPaymentIds.has(id));
    if (missingPayments.length > 0) {
      console.error(`❌ Found ${missingPayments.length} PatronGrant(s) referencing missing Payment!`);
      integrityFailures++;
    } else {
      console.log("✓ No payment-linked PatronGrants referencing missing Payment.");
    }

    // 3. VideoAsset referencing missing Video
    const assets = await prisma.videoAsset.findMany({
        select: { videoId: true }
    });
    const videoIdsInAssets = Array.from(new Set(assets.map(a => a.videoId)));
    const existingVideos = await prisma.video.findMany({
        where: { id: { in: videoIdsInAssets } },
        select: { id: true }
    });
    const existingVideoIds = new Set(existingVideos.map(v => v.id));
    const missingVideos = videoIdsInAssets.filter(id => !existingVideoIds.has(id));

    if (missingVideos.length > 0) {
      console.error(`❌ Found VideoAsset(s) referencing ${missingVideos.length} missing Video(s)!`);
      integrityFailures++;
    } else {
        console.log("✓ No orphaned VideoAssets detected.");
    }

    // F. Expected Manifest Comparison
    if (manifestPath) {
      console.log("\n[F] Expected Manifest Comparison");
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        let manifestMismatches = 0;

        for (const [key, expectedValue] of Object.entries(manifest.counts || {})) {
          const actualValue = counts[key];
          if (actualValue === undefined) {
            console.warn(`! Field ${key} not found in restored aggregates.`);
          } else if (actualValue !== expectedValue) {
            console.error(`❌ Mismatch for ${key}: expected ${expectedValue}, got ${actualValue}`);
            manifestMismatches++;
          } else {
            console.log(`✓ ${key} matches manifest.`);
          }
        }

        if (manifestMismatches > 0) {
          console.error(`❌ Detected ${manifestMismatches} manifest mismatch(es)!`);
          process.exit(1);
        }
      } catch (e: any) {
        console.error(`❌ Error reading/parsing manifest: ${e.message}`);
        process.exit(1);
      }
    }

    if (integrityFailures > 0) {
      console.error(`\n❌ VERIFICATION FAILED: ${integrityFailures} integrity issue(s) detected.`);
      process.exit(1);
    }

    console.log("\n🚀 VERIFICATION SUCCESSFUL: Restored database appears valid.");

  } catch (e: any) {
    console.error(`\n❌ UNEXPECTED ERROR: ${e.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
