import { PrismaClient, VideoStatus, type ChannelStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Same rule as MainChannelPolicy.isPubliclyVisible (CLAUDE.md 4.24): ACTIVE or LIMITED, not deleted.
const PUBLIC_CREATOR = { status: { in: ['ACTIVE', 'LIMITED'] as ChannelStatus[] }, deletedAt: null };

async function main() {
  console.log("=== DIAGNOSTYKA TREŚCI (v5) ===");

  const now = new Date();
  console.log(`Czas serwera: ${now.toISOString()}`);

  const dbUrl = process.env.DATABASE_URL || "unknown";
  const safeUrl = dbUrl.replace(/:[^:@]+@/, ":****@");
  console.log(`Baza: ${safeUrl}`);

  try {
    const counters = {
        allVideos: 0,
        published: 0,
        publicCreators: 0,
        mainChannelConfigured: 0,
        publicCreatorVideos: 0,
        publishWindow: 0,
        exactHomeQuery: 0,
    };

    const safeCount = async (where?: any) => {
      try {
        return await (where ? prisma.video.count({ where }) : prisma.video.count());
      } catch (e: any) {
        console.error(`[DIAGNOSE_ERROR] Count failed: ${e.message}`);
        return -1;
      }
    };

    counters.allVideos = await safeCount();
    counters.published = await safeCount({ status: VideoStatus.PUBLISHED });

    try {
      counters.publicCreators = await prisma.creator.count({ where: PUBLIC_CREATOR });
      counters.mainChannelConfigured = await prisma.appSetting.count({ where: { key: 'main_channel_id' } });
    } catch (e: any) {
      console.error(`[DIAGNOSE_ERROR] Creator count failed: ${e.message}`);
    }

    counters.publicCreatorVideos = await safeCount({
      status: VideoStatus.PUBLISHED,
      creator: PUBLIC_CREATOR
    });

    counters.publishWindow = await safeCount({
      status: VideoStatus.PUBLISHED,
      creator: PUBLIC_CREATOR,
      OR: [
        { publishedAt: null },
        { publishedAt: { lte: now } }
      ]
    });

    console.log(`\n--- Liczniki Etapowe ---`);
    console.log(`1. Wszystkie filmy (allVideosCount): ${counters.allVideos}`);
    console.log(`2. Filmy PUBLISHED: ${counters.published}`);
    console.log(`3. Publiczne kanały (status ACTIVE/LIMITED, publicCreatorsCount): ${counters.publicCreators}`);
    console.log(`4. Ustawienie kanału głównego main_channel_id (0 = brak): ${counters.mainChannelConfigured}`);
    console.log(`5. Filmy PUBLISHED na publicznym kanale (publicCreatorVideosCount): ${counters.publicCreatorVideos}`);
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
      const vStatus = v.status;
      const vTier = v.tier;
      const vPublishedAt = v.publishedAt ? new Date(v.publishedAt) : null;
      const cSlug = v.creator?.slug || 'MISSING';
      const cStatus = v.creator?.status || 'MISSING';
      const cPublic = !!v.creator && !v.creator.deletedAt && (cStatus === 'ACTIVE' || cStatus === 'LIMITED');

      if (vStatus === VideoStatus.DRAFT) reasons.push(`status is DRAFT`);
      else if (vStatus === VideoStatus.ARCHIVED) reasons.push(`status is ARCHIVED`);
      else if (vStatus !== VideoStatus.PUBLISHED) reasons.push(`status is ${vStatus}`);

      if (!v.creator) reasons.push("missing creator");
      else if (!cPublic) reasons.push(`creator is not public (status ${cStatus})`);

      if (vPublishedAt && vPublishedAt > now) reasons.push(`publishedAt is in the future (${vPublishedAt.toISOString()})`);
      if (!v.slug) reasons.push("missing slug");
      if (!v.title) reasons.push("missing title");
      if (!v.thumbnailUrl) reasons.push("missing thumbnailUrl");

      const isVisible = reasons.length === 0;
      console.log(`${String(i+1).padStart(2, ' ')}. [${isVisible ? 'WIDOCZNY' : 'UKRYTY'}] "${v.title}" (${v.slug})`);
      console.log(`    [ID: ${v.id}] [Status: ${vStatus}] [Tier: ${vTier}] [PubAt: ${vPublishedAt?.toISOString() || 'NULL'}]`);
      console.log(`    [Creator: ${cSlug}] [ChannelStatus: ${cStatus}] [Public: ${cPublic}]`);
      if (!isVisible) console.log(`    Powody: ${reasons.join(", ")}`);
    });

    console.log(`\n--- Runtime ContentService Check ---`);
    try {
        const { VideoContentService: ContentService } = await import('../lib/modules/video/infrastructure/video-content.service');
        const allVideos = await ContentService.getAllVideos();
        const mainVideo = await ContentService.getMainFeaturedVideo();

        console.log(`ContentService.getAllVideos() count: ${allVideos.length}`);
        console.log(`ContentService.getMainFeaturedVideo(): ${mainVideo ? mainVideo.title : 'NULL'}`);
    } catch (err: any) {
        console.log(`BŁĄD przy ContentService: ${err.name} - ${err.message}`);
        console.log(`Prisma Code: ${err.code || 'N/A'}`);
    }

    if (counters.publishWindow === 0) {
        console.log(`\n--- ROOT CAUSE IDENTIFICATION ---`);
        if (counters.allVideos === 0) console.log("ROOT CAUSE: DB is empty. Action: npm run db:setup:dev");
        else if (counters.published === 0) console.log("ROOT CAUSE: No videos are PUBLISHED. Action: npm run content:fix:main-creator");
        else if (counters.publicCreators === 0) console.log("ROOT CAUSE: No channel is publicly visible (ACTIVE/LIMITED). Action: set the channel status in the admin panel");
        else if (counters.mainChannelConfigured === 0) console.log("ROOT CAUSE: main_channel_id setting is missing. Action: apply migration 20261014090000_main_channel_setting or set it in the panel");
        else console.log("ROOT CAUSE: Possible schema mismatch or future publication dates. Action: npm run db:migrate:deploy");
    }

  } catch (err: any) {
    console.error("CRITICAL DIAGNOSE ERROR:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
