import { PrismaClient, VideoStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== POLUTEK.PL DIAGNOSTYKA TREŚCI (v2) ===");

  const now = new Date();
  console.log(`Czas serwera: ${now.toISOString()}`);

  const dbUrl = process.env.DATABASE_URL || "unknown";
  const safeUrl = dbUrl.replace(/:[^:@]+@/, ":****@");
  console.log(`Baza: ${safeUrl}`);

  try {
    // Stage 1: Basic Counts with robustness for missing columns
    let allVideosCount = 0;
    try { allVideosCount = await prisma.video.count(); } catch (e: unknown) {
        console.log("BŁĄD przy Video.count():", (e as Error).message);
        console.log("ROOT CAUSE: Tabela 'Video' może nie istnieć lub schemat jest nieaktualny.");
        console.log("ROZWIĄZANIE: npx prisma migrate deploy lub npx prisma db push");
        return;
    }

    let publishedVideosCount = 0;
    try { publishedVideosCount = await prisma.video.count({ where: { status: VideoStatus.PUBLISHED } }); }
    catch (e: unknown) {
        console.log("BŁĄD przy liczeniu PUBLISHED:", (e as Error).message);
        if ((e as Error).message.includes("column Video.status does not exist")) {
            console.log("ROOT CAUSE: Kolumna 'status' nie istnieje w tabeli Video.");
            console.log("ROZWIĄZANIE: npx prisma migrate deploy");
        }
    }

    const approvedCreatorsCount = await prisma.creator.count({ where: { isApproved: true } });
    const primaryCreatorsCount = await prisma.creator.count({ where: { isPrimary: true } });

    let approvedCreatorVideosCount = 0;
    try {
        approvedCreatorVideosCount = await prisma.video.count({
          where: {
            status: VideoStatus.PUBLISHED,
            creator: { isApproved: true }
          }
        });
    } catch (e) {}

    let publishWindowVideosCount = 0;
    try {
        publishWindowVideosCount = await prisma.video.count({
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
    console.log(`1. Wszystkie filmy (allVideosCount): ${allVideosCount}`);
    console.log(`2. Filmy PUBLISHED: ${publishedVideosCount}`);
    console.log(`3. Zatwierdzeni twórcy: ${approvedCreatorsCount}`);
    console.log(`4. Główni twórcy (isPrimary): ${primaryCreatorsCount}`);
    console.log(`5. Filmy PUBLISHED + Approved Creator: ${approvedCreatorVideosCount}`);
    console.log(`6. Filmy w oknie publikacji (publishWindowVideosCount): ${publishWindowVideosCount}`);

    console.log(`\n--- Szczegóły pierwszych 50 filmów (powody niewidoczności) ---`);
    const videos = await prisma.video.findMany({
      take: 50,
      include: { creator: true },
      orderBy: { createdAt: 'desc' }
    });

    videos.forEach((v, i) => {
      const reasons: string[] = [];
      if (v.status !== VideoStatus.PUBLISHED) reasons.push(`status is ${v.status}`);

      if (!v.creator) {
          reasons.push("missing creator");
      } else {
          if (!v.creator.isApproved) reasons.push("creator is not approved");
      }

      const pubAt = v.publishedAt ? new Date(v.publishedAt) : null;
      if (pubAt && pubAt > now) {
          reasons.push(`publishedAt is in the future (${pubAt.toISOString()})`);
      }

      if (!v.thumbnailUrl) reasons.push("missing thumbnailUrl");
      if (!v.slug) reasons.push("missing slug");

      const isVisible = reasons.length === 0;
      console.log(`${i+1}. [${isVisible ? 'WIDOCZNY' : 'UKRYTY'}] "${v.title}" (${v.slug})`);
      if (!isVisible) {
          console.log(`   Powody: ${reasons.join(", ")}`);
      }
    });

    console.log(`\n--- Wyniki ContentService (Runtime Checks) ---`);
    try {
        const { ContentService } = await import('../lib/services/content.service');
        const allVideos = await ContentService.getAllVideos();
        const mainVideo = await ContentService.getMainFeaturedVideo();

        console.log(`ContentService.getAllVideos() count: ${allVideos.length}`);
        console.log(`ContentService.getMainFeaturedVideo(): ${mainVideo ? mainVideo.title : 'NULL'}`);

        if (publishWindowVideosCount > 0 && allVideos.length === 0) {
            console.log("\n!!! ALARM: Dane w DB są poprawne (widoczne), ale ContentService zwraca pustą listę !!!");
            console.log("Sprawdź buildPublicVideoWhere() w lib/services/content.service.ts");
        }
    } catch (err: unknown) {
        console.log(`BŁĄD przy ContentService:`);
        console.log(`  Name: ${(err as Error).name}`);
        console.log(`  Message: ${(err as Error).message}`);
        if ((err as any).code) console.log(`  Prisma code: ${(err as any).code}`);
    }

    if (publishWindowVideosCount === 0) {
        console.log(`\n--- IDENTYFIKACJA PRZYCZYNY (ROOT CAUSE) ---`);
        if (allVideosCount === 0) {
            console.log("ROOT CAUSE: Baza danych jest pusta.");
            console.log("ROZWIĄZANIE: npm run db:setup:dev");
        } else if (publishedVideosCount === 0) {
            console.log("ROOT CAUSE: Żaden film nie ma statusu PUBLISHED.");
            console.log("ROZWIĄZANIE: Zmień status filmu w panelu admina lub użyj npm run content:fix:polutek");
        } else if (approvedCreatorVideosCount === 0) {
            console.log("ROOT CAUSE: Creatorzy nie są zatwierdzeni (isApproved=false).");
            console.log("ROZWIĄZANIE: npm run content:fix:polutek");
        } else if (publishWindowVideosCount === 0) {
            console.log("ROOT CAUSE: Wszystkie filmy mają datę publikacji w przyszłości.");
            console.log("ROZWIĄZANIE: npx prisma migrate deploy (uruchomi backfill dat)");
        }
    }

  } catch (err: unknown) {
    console.error("BŁĄD KRYTYCZNY DIAGNOSTYKI:", (err as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
