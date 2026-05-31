import { PrismaClient, VideoStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== POLUTEK.PL DIAGNOSTYKA TREŚCI ===");

  const now = new Date();
  console.log(`Czas serwera: ${now.toISOString()}`);

  const dbUrl = process.env.DATABASE_URL || "unknown";
  const safeUrl = dbUrl.replace(/:[^:@]+@/, ":****@");
  console.log(`Baza: ${safeUrl}`);

  try {
    const allVideosCount = await prisma.video.count();
    const publishedVideosCount = await prisma.video.count({ where: { status: VideoStatus.PUBLISHED } });
    const approvedCreatorsCount = await prisma.creator.count({ where: { isApproved: true } });
    const primaryCreatorsCount = await prisma.creator.count({ where: { isPrimary: true } });

    const approvedCreatorVideosCount = await prisma.video.count({
      where: {
        status: VideoStatus.PUBLISHED,
        creator: { isApproved: true }
      }
    });

    const publishWindowVideosCount = await prisma.video.count({
      where: {
        status: VideoStatus.PUBLISHED,
        creator: { isApproved: true },
        OR: [
          { publishedAt: null },
          { publishedAt: { lte: now } }
        ]
      }
    });

    console.log(`\n--- Liczniki ---`);
    console.log(`Wszystkie filmy (allVideosCount): ${allVideosCount}`);
    console.log(`Filmy PUBLISHED: ${publishedVideosCount}`);
    console.log(`Zatwierdzeni twórcy: ${approvedCreatorsCount}`);
    console.log(`Główni twórcy (isPrimary): ${primaryCreatorsCount}`);
    console.log(`Filmy PUBLISHED + Approved Creator: ${approvedCreatorVideosCount}`);
    console.log(`Filmy w oknie publikacji (publishWindowVideosCount): ${publishWindowVideosCount}`);

    console.log(`\n--- Szczegóły pierwszych 50 filmów ---`);
    const videos = await prisma.video.findMany({
      take: 50,
      include: { creator: true },
      orderBy: { createdAt: 'desc' }
    });

    videos.forEach((v, i) => {
      const reasons: string[] = [];
      if (v.status !== VideoStatus.PUBLISHED) reasons.push(`status is ${v.status}`);
      if (!v.creator) reasons.push("missing creator");
      else if (!v.creator.isApproved) reasons.push("creator is not approved");

      const pubAt = v.publishedAt ? new Date(v.publishedAt) : null;
      if (pubAt && pubAt > now) reasons.push(`publishedAt is in the future (${pubAt.toISOString()})`);

      if (!v.thumbnailUrl) reasons.push("missing thumbnailUrl");
      if (!v.slug) reasons.push("missing slug");

      const isVisible = reasons.length === 0;
      console.log(`${i+1}. [${isVisible ? 'WIDOCZNY' : 'UKRYTY'}] "${v.title}" (${v.slug})`);
      if (!isVisible) {
          console.log(`   Powody: ${reasons.join(", ")}`);
      }
    });

    console.log(`\n--- Wyniki ContentService ---`);
    try {
        const { ContentService } = await import('../lib/services/content.service');
        const allVideos = await ContentService.getAllVideos();
        const mainVideo = await ContentService.getMainFeaturedVideo();

        console.log(`ContentService.getAllVideos() count: ${allVideos.length}`);
        console.log(`ContentService.getMainFeaturedVideo(): ${mainVideo ? mainVideo.title : 'NULL'}`);

        if (publishWindowVideosCount > 0 && allVideos.length === 0) {
            console.log("\n!!! ALARM: Dane w DB są poprawne, ale ContentService zwraca pustą listę !!!");
        }
    } catch (err: any) {
        console.log(`BŁĄD ContentService: ${err.name} - ${err.message}`);
        if (err.code) console.log(`Prisma code: ${err.code}`);
    }

  } catch (err: any) {
    console.error("BŁĄD KRYTYCZNY DIAGNOSTYKI:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
