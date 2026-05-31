import { PrismaClient, VideoStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== POLUTEK.PL DIAGNOSTYKA TREŚCI (v4) ===");

  const now = new Date();
  console.log(`Czas serwera: ${now.toISOString()}`);

  const dbUrl = process.env.DATABASE_URL || "unknown";
  const safeUrl = dbUrl.replace(/:[^:@]+@/, ":****@");
  console.log(`Baza: ${safeUrl}`);

  try {
    // Stage 1: Basic Counts with robustness
    const counters = {
        allVideos: 0,
        published: 0,
        approvedCreators: 0,
        primaryCreators: 0,
        approvedCreatorVideos: 0,
        publishWindow: 0,
    };

    try { counters.allVideos = await prisma.video.count(); } catch (e: any) {
        console.log("!!! BŁĄD przy Video.count():", e.message);
    }

    try { counters.published = await prisma.video.count({ where: { status: VideoStatus.PUBLISHED } }); }
    catch (e: any) {
        console.log("!!! BŁĄD przy liczeniu PUBLISHED:", e.message);
    }

    try { counters.approvedCreators = await prisma.creator.count({ where: { isApproved: true } }); } catch (e: any) {}
    try { counters.primaryCreators = await prisma.creator.count({ where: { isPrimary: true } }); } catch (e: any) {}

    try {
        counters.approvedCreatorVideos = await prisma.video.count({
          where: {
            status: VideoStatus.PUBLISHED,
            creator: { isApproved: true }
          }
        });
    } catch (e) {}

    try {
        counters.publishWindow = await prisma.video.count({
          where: {
            status: VideoStatus.PUBLISHED,
            creator: { isApproved: true },
            OR: [
              { publishedAt: null },
              { publishedAt: { lte: now } }
            ]
          }
        });
    } catch (e) {}

    console.log(`\n--- Liczniki Etapowe ---`);
    console.log(`1. Wszystkie filmy (allVideosCount): ${counters.allVideos}`);
    console.log(`2. Filmy PUBLISHED: ${counters.published}`);
    console.log(`3. Zatwierdzeni twórcy: ${counters.approvedCreators}`);
    console.log(`4. Główni twórcy (isPrimary): ${counters.primaryCreators}`);
    console.log(`5. Filmy PUBLISHED + Approved Creator: ${counters.approvedCreatorVideos}`);
    console.log(`6. Filmy w oknie publikacji (publishWindow): ${counters.publishWindow} (FINALNA WIDOCZNOŚĆ)`);

    console.log(`\n--- Szczegóły pierwszych 50 filmów ---`);
    let videos: any[] = [];
    try {
        videos = await prisma.video.findMany({
          take: 50,
          include: { creator: true },
          orderBy: { createdAt: 'desc' }
        });
    } catch (e: any) {
        console.log("!!! BŁĄD przy Video.findMany():", e.message);
    }

    videos.forEach((v, i) => {
      const reasons: string[] = [];
      if (v.status !== VideoStatus.PUBLISHED) reasons.push(`status is ${v.status}`);
      if (!v.creator) reasons.push("missing creator");
      else if (!v.creator.isApproved) reasons.push("creator is not approved");

      const pubAt = v.publishedAt ? new Date(v.publishedAt) : null;
      if (pubAt && pubAt > now) reasons.push(`publishedAt is in the future (${pubAt.toISOString()})`);

      const isVisible = reasons.length === 0;
      console.log(`${i+1}. [${isVisible ? 'WIDOCZNY' : 'UKRYTY'}] "${v.title}" (${v.slug})`);
      if (!isVisible) console.log(`   Powody: ${reasons.join(", ")}`);
    });

    console.log(`\n--- Runtime ContentService Check ---`);
    try {
        const { ContentService } = await import('../lib/services/content.service');
        const allVideos = await ContentService.getAllVideos();
        const mainVideo = await ContentService.getMainFeaturedVideo();

        console.log(`ContentService.getAllVideos() count: ${allVideos.length}`);
        console.log(`ContentService.getMainFeaturedVideo(): ${mainVideo ? mainVideo.title : 'NULL'}`);
    } catch (err: any) {
        console.log(`BŁĄD przy ContentService: ${err.name} - ${err.message}`);
    }

    if (counters.publishWindow === 0) {
        console.log(`\n--- ROOT CAUSE IDENTIFICATION ---`);
        if (counters.allVideos === 0) console.log("ROOT CAUSE: DB is empty. Action: npm run db:setup:dev");
        else if (counters.published === 0) console.log("ROOT CAUSE: No videos are PUBLISHED. Action: npm run content:fix:polutek");
        else if (counters.approvedCreators === 0) console.log("ROOT CAUSE: No creators are approved. Action: npm run content:fix:polutek");
        else console.log("ROOT CAUSE: Possible schema mismatch or future publication dates. Action: npm run db:fix:schema");
    }

  } catch (err: any) {
    console.error("CRITICAL DIAGNOSE ERROR:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
