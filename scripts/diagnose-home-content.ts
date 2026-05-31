import { PrismaClient, VideoStatus } from '@prisma/client';
import { explainVideoVisibility } from '../lib/services/content.visibility';

const prisma = new PrismaClient();

async function main() {
  console.log("--- DIAGNOSTYKA TREŚCI STRONY GŁÓWNEJ ---");

  const dbUrl = process.env.DATABASE_URL || "unknown";
  const safeUrl = dbUrl.replace(/:[^:@]+@/, ":****@");
  console.log(`Database URL: ${safeUrl}`);

  const creators = await prisma.creator.findMany();
  console.log(`Liczba creatorów: ${creators.length}`);
  console.log(`Liczba approved creatorów: ${creators.filter(c => c.isApproved).length}`);
  console.log(`Liczba primary creatorów: ${creators.filter(c => c.isPrimary).length}`);

  const videos = await prisma.video.findMany({
    include: {
      creator: true
    }
  });

  console.log(`Liczba filmów ogółem: ${videos.length}`);

  const statusCounts = videos.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log("Filmy per status:", statusCounts);

  const now = new Date();
  console.log("Data 'now':", now.toISOString());

  console.log("\nPierwsze 20 filmów i ich status widoczności:");
  const first20 = videos.slice(0, 20);
  first20.forEach(v => {
    const explanation = explainVideoVisibility(v, now);
    console.log(`- ID: ${v.id}
  Tytuł: ${v.title}
  Slug: ${v.slug}
  Status: ${v.status}
  PublishedAt: ${v.publishedAt?.toISOString() || 'null'}
  Creator: ${v.creator?.slug} (Approved: ${v.creator?.isApproved}, Primary: ${v.creator?.isPrimary})
  Visible: ${explanation.visible} ${explanation.visible ? "" : "(" + explanation.reasons.join(", ") + ")"}
`);
  });

  const visibleVideos = videos.filter(v => explainVideoVisibility(v, now).visible);
  console.log(`\nŁączna liczba filmów widocznych publicznie: ${visibleVideos.length}`);

  try {
      // Import the actual service to compare results
      const { ContentService } = await import('../lib/services/content.service');
      const allVideos = await ContentService.getAllVideos();
      const mainVideo = await ContentService.getMainFeaturedVideo();
      console.log(`\nContentService.getAllVideos() returned: ${allVideos.length} videos`);
      console.log(`ContentService.getMainFeaturedVideo() returned: ${mainVideo ? mainVideo.title : "null"}`);
  } catch (e) {
      console.warn("\nCould not run ContentService checks in script (likely missing environment/clerk config)");
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
