import { PrismaClient, VideoStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("--- DIAGNOSTYKA TREŚCI STRONY GŁÓWNEJ ---");

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

  const first10 = videos.slice(0, 10);
  console.log("\nPierwsze 10 filmów:");
  first10.forEach(v => {
    const isPubliclyVisible =
      v.status === VideoStatus.PUBLISHED &&
      v.creator.isApproved &&
      (v.publishedAt === null || v.publishedAt <= now);

    console.log(`- ID: ${v.id}
  Tytuł: ${v.title}
  Slug: ${v.slug}
  Status: ${v.status}
  PublishedAt: ${v.publishedAt?.toISOString() || 'null'}
  Creator: ${v.creator.name} (Approved: ${v.creator.isApproved}, Primary: ${v.creator.isPrimary})
  Tier: ${v.tier}
  Publicly Visible: ${isPubliclyVisible}
`);
  });

  const homeVideosQuery = await prisma.video.findMany({
    where: {
      status: VideoStatus.PUBLISHED,
      creator: {
        isApproved: true,
      },
      OR: [
        { publishedAt: null },
        { publishedAt: { lte: now } },
      ],
    }
  });

  console.log(`\nLiczba filmów które powinny być na Home (wg query): ${homeVideosQuery.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
