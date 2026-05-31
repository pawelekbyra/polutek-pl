import { PrismaClient, VideoStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== NAPRAWA TREŚCI TWÓRCY: POLUTEK ===");

  const autoFix = process.env.AUTO_FIX_DEV_CONTENT === "true" && process.env.NODE_ENV !== "production";
  if (autoFix) {
      console.log("Tryb AUTO_FIX_DEV_CONTENT aktywny.");
  }

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
    const hasPrimary = await prisma.creator.findFirst({ where: { isPrimary: true, id: { not: polutek.id } } });

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
    console.log(`- isPrimary: ${polutek.isPrimary || !hasPrimary}`);
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
