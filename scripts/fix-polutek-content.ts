import { PrismaClient, VideoStatus, AccessTier } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== NAPRAWA I POPULACJA TREŚCI TWÓRCY: POLUTEK ===");

  try {
    let polutek = await prisma.creator.findUnique({ where: { slug: 'polutek' } });

    if (!polutek) {
      console.log("Nie znaleziono twórcy o slugu 'polutek'. Próba znalezienia admina...");
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

      if (!admin) {
        console.log("BŁĄD: Brak admina w bazie. Uruchom najpierw npm run db:seed");
        return;
      }

      console.log(`Tworzenie twórcy 'polutek' dla admina ${admin.email}...`);
      polutek = await prisma.creator.create({
        data: {
          slug: 'polutek',
          name: 'POLUTEK.PL',
          userId: admin.id,
          isApproved: true,
          isPrimary: true
        }
      });
    }

    console.log(`Znaleziono twórcę: ${polutek.name} (ID: ${polutek.id})`);

    const initialVisible = await countVisible();
    console.log(`Liczba widocznych filmów przed naprawą: ${initialVisible}`);

    console.log("Zatwierdzanie twórcy...");
    const otherPrimary = await prisma.creator.findFirst({
      where: { isPrimary: true, id: { not: polutek.id } }
    });

    await prisma.creator.update({
      where: { id: polutek.id },
      data: {
        isApproved: true,
        isPrimary: polutek.isPrimary || !otherPrimary
      }
    });

    // Ensure core videos exist
    const targetVideos = [
      {
        slug: 'historia-powstania-osady',
        title: 'Historia powstania Osady Natury "Zew" w gruncie ruchu Stefan',
        videoUrl: 'https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/historia-powstania-osady-natury-zew-w-gruncie-ruchu-stefan.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
        isMainFeatured: true,
        tier: AccessTier.PUBLIC
      },
      {
        slug: 'intencja-swiadomosc-sprawczosci',
        title: 'Intencja - świadomość sprawczości - Michał Kiciński Q&A',
        videoUrl: 'https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/intencja-swiadomosc-sprawczosci-michal-kicinski-qa-festiwal-wibracje.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2659&auto=format&fit=crop',
        isMainFeatured: false,
        tier: AccessTier.LOGGED_IN
      }
    ];

    console.log(`Zapewnianie istnienia ${targetVideos.length} kluczowych filmów...`);

    for (const v of targetVideos) {
      await prisma.video.upsert({
        where: { slug: v.slug },
        update: {
          title: v.title,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl,
          isMainFeatured: v.isMainFeatured,
          status: VideoStatus.PUBLISHED,
          publishedAt: new Date()
        },
        create: {
          creatorId: polutek.id,
          slug: v.slug,
          title: v.title,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl,
          isMainFeatured: v.isMainFeatured,
          tier: v.tier,
          status: VideoStatus.PUBLISHED,
          publishedAt: new Date()
        }
      });
    }

    const videosToFix = await prisma.video.findMany({
      where: {
        creatorId: polutek.id,
        status: VideoStatus.PUBLISHED,
        publishedAt: null
      }
    });

    console.log(`Naprawianie pozostałych filmów PUBLISHED bez daty publikacji: ${videosToFix.length}`);

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
    console.log(`- Widoczne filmy po naprawie: ${finalVisible}`);

    if (finalVisible > 0) {
        console.log("\nSUKCES: Baza została zasilona linkami. Strona główna powinna działać.");
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
