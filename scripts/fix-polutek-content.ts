import { PrismaClient, VideoStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== NAPRAWA TREŚCI TWÓRCY: POLUTEK ===");

  try {
    const polutek = await prisma.creator.findUnique({ where: { slug: 'polutek' } });

    if (!polutek) {
      console.log("Nie znaleziono twórcy o slugu 'polutek'.");
      return;
    }

    console.log(`Znaleziono twórcę: ${polutek.name} (ID: ${polutek.id})`);
    console.log(`Stan początkowy: isApproved=${polutek.isApproved}, isPrimary=${polutek.isPrimary}`);

    const hasPrimary = await prisma.creator.findFirst({ where: { isPrimary: true } });

    await prisma.creator.update({
      where: { id: polutek.id },
      data: {
        isApproved: true,
        isPrimary: polutek.isPrimary || !hasPrimary
      }
    });

    const videosToFix = await prisma.video.findMany({
      where: {
        creatorId: polutek.id,
        status: VideoStatus.PUBLISHED,
        publishedAt: null
      }
    });

    console.log(`Liczba filmów do poprawy (PUBLISHED, brak daty): ${videosToFix.length}`);

    for (const v of videosToFix) {
      await prisma.video.update({
        where: { id: v.id },
        data: {
          publishedAt: v.createdAt || new Date()
        }
      });
    }

    const polutekUpdated = await prisma.creator.findUnique({ where: { id: polutek.id } });
    console.log(`Stan końcowy: isApproved=${polutekUpdated?.isApproved}, isPrimary=${polutekUpdated?.isPrimary}`);
    console.log("Gotowe.");

  } catch (err: any) {
    console.error("BŁĄD NAPRAWY:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
