import { PrismaClient, VideoStatus, AccessTier } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== NAPRAWA I POPULACJA TREŚCI MVP: Paweł Perfect ===");

  try {
    let polutek = await prisma.creator.findUnique({ where: { slug: 'polutek' } });

    if (!polutek) {
      console.log("Nie znaleziono twórcy o slugu 'polutek'. Próba znalezienia admina...");
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

      if (!admin) {
        console.log("BŁĄD: Brak admina w bazie. Uruchom najpierw npm run db:seed");
        return;
      }

      console.log(`Tworzenie twórcy 'polutek' (Paweł Perfect) dla admina ${admin.email}...`);
      polutek = await prisma.creator.create({
        data: {
          slug: 'polutek',
          name: 'Paweł Perfect',
          userId: admin.id,
          isApproved: true,
          isPrimary: true,
          subscribersCount: 1250000
        }
      });
    }

    console.log(`Znaleziono twórcę: ${polutek.name} (ID: ${polutek.id})`);

    console.log("Aktualizacja brandingu twórcy...");
    await prisma.creator.update({
      where: { id: polutek.id },
      data: {
        name: 'Paweł Perfect',
        isApproved: true,
        isPrimary: true,
        subscribersCount: 1250000
      }
    });

    // Ensure core videos exist for MVP
    const targetVideos = [
      {
        slug: 'wuthering-heights-cover',
        title: "You don't have the guts to log in",
        videoUrl: 'https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/Wuthering-Heights.mp4',
        thumbnailUrl: '/wuthering.jpg',
        isMainFeatured: true,
        tier: AccessTier.PUBLIC,
        views: 1250400,
        likesCount: 45000
      },
      {
        slug: 'historia-powstania-osady',
        title: 'Secret Project',
        videoUrl: 'https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/historia-powstania-osady-natury-zew-w-gruncie-ruchu-stefan.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
        isMainFeatured: false,
        tier: AccessTier.LOGGED_IN
      },
      {
        slug: 'intencja-swiadomosc-sprawczosci',
        title: 'Udało się!!!',
        videoUrl: 'https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/intencja-swiadomosc-sprawczosci-michal-kicinski-qa-festiwal-wibracje.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2659&auto=format&fit=crop',
        isMainFeatured: false,
        tier: AccessTier.PATRON
      }
    ];

    console.log(`Zapewnianie istnienia ${targetVideos.length} kluczowych filmów MVP...`);

    for (const v of targetVideos) {
      await prisma.video.upsert({
        where: { slug: v.slug },
        update: {
          title: v.title,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl,
          isMainFeatured: v.isMainFeatured,
          status: VideoStatus.PUBLISHED,
          publishedAt: new Date(),
          views: v.views,
          likesCount: v.likesCount
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
          publishedAt: new Date(),
          views: v.views || 0,
          likesCount: v.likesCount || 0
        }
      });
    }

    const finalVisible = await countVisible();
    console.log(`\nStan końcowy MVP:`);
    console.log(`- Nazwa twórcy: Paweł Perfect`);
    console.log(`- Widoczne filmy: ${finalVisible}`);

    if (finalVisible > 0) {
        console.log("\nSUKCES: Baza została zasilona materiałami MVP. Strona główna powinna teraz wyświetlać Paweł Perfect & You don't have the guts to log in.");
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
