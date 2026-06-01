import { PrismaClient, VideoStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== NAPRAWA TREŚCI TWÓRCY: POLUTEK ===");

  try {
    const polutek = await prisma.creator.findUnique({ where: { slug: 'polutek' } });

    if (!polutek) {
      console.log("Nie znaleziono twórcy o slugu 'polutek'.");
      console.log("Upewnij się, że uruchomiono npm run db:seed.");
      return;
    }

    console.log(`Znaleziono twórcę: ${polutek.name} (ID: ${polutek.id})`);

    const initialVisible = await countVisible();
    console.log(`Liczba widocznych filmów przed naprawą: ${initialVisible}`);

    console.log("Zatwierdzanie twórcy...");
    // Check if any other creator is primary
    const otherPrimary = await prisma.creator.findFirst({
      where: {
        isPrimary: true,
        id: { not: polutek.id }
      }
    });

    await prisma.creator.update({
      where: { id: polutek.id },
      data: {
        isApproved: true,
        // Set as primary only if it already was or if no one else is primary
        isPrimary: polutek.isPrimary || !otherPrimary
      }
    });

    const videosToFix = await prisma.video.findMany({
      where: {
        creatorId: polutek.id,
        status: VideoStatus.PUBLISHED,
        publishedAt: null
      }
    });

    console.log(`Naprawianie filmów PUBLISHED bez daty publikacji: ${videosToFix.length}`);

    for (const v of videosToFix) {
      await prisma.video.update({
        where: { id: v.id },
        data: {
          publishedAt: v.createdAt || new Date()
        }
      });
    }

    const finalVisible = await countVisible();
    console.log(`\nStan końcowy:`);
    console.log(`- isApproved: true`);
    console.log(`- isPrimary: ${polutek.isPrimary || !otherPrimary}`);
    console.log(`- Widoczne filmy po naprawie: ${finalVisible}`);

    if (finalVisible > 0) {
        console.log("\nSUKCES: Strona główna powinna teraz wyświetlać materiały.");
    } else {
        console.log("\nUWAGA: Nadal brak widocznych filmów. Sprawdź npm run content:diagnose");
    }

  } catch (err: unknown) {
    console.error("BŁĄD NAPRAWY:", (err as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}

async function countVisible() {
    const now = new Date();
    return await prisma.video.count({
      where: {
        status: VideoStatus.PUBLISHED,
        creator: { isApproved: true },
        OR: [
          { publishedAt: null },
          { publishedAt: { lte: now } }
        ]
      }
    });
}

main();
