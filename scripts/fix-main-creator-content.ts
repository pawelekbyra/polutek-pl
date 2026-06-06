import { PrismaClient, VideoStatus, AccessTier } from '@prisma/client';

const prisma = new PrismaClient();

const creatorSlug = process.env.MAIN_CREATOR_SLUG;
const creatorDisplayName = process.env.MAIN_CREATOR_NAME || creatorSlug;

async function main() {
  console.log("=== NAPRAWA I POPULACJA TREŚCI MVP DLA SKONFIGUROWANEGO TWÓRCY ===");

  if (!creatorSlug) {
    console.log("BŁĄD: Brak MAIN_CREATOR_SLUG w środowisku. Ustaw slug twórcy przed uruchomieniem skryptu.");
    return;
  }

  try {
    let creator = await prisma.creator.findUnique({ where: { slug: creatorSlug } });

    if (!creator) {
      console.log(`Nie znaleziono twórcy o slugu z MAIN_CREATOR_SLUG (${creatorSlug}). Próba znalezienia admina...`);
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

      if (!admin) {
        console.log("BŁĄD: Brak admina w bazie. Uruchom najpierw npm run db:seed");
        return;
      }

      console.log(`Tworzenie twórcy ${creatorSlug} dla admina ${admin.email}...`);
      creator = await prisma.creator.create({
        data: {
          slug: creatorSlug,
          name: creatorDisplayName || creatorSlug,
          userId: admin.id,
          isApproved: true,
          isPrimary: true,
          subscribersCount: 0
        }
      });
    }

    console.log(`Znaleziono twórcę: ${creator.name} (ID: ${creator.id})`);

    const realSubscribersCount = await prisma.subscription.count({
      where: { creatorId: creator.id }
    });

    console.log("Aktualizacja brandingu twórcy...");
    await prisma.creator.update({
      where: { id: creator.id },
      data: {
        name: creatorDisplayName || creator.name,
        isApproved: true,
        isPrimary: true,
        subscribersCount: realSubscribersCount
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
          creatorId: creator.id,
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
    console.log(`- Nazwa twórcy: ${creatorDisplayName || creator.name}`);
    console.log(`- Widoczne filmy: ${finalVisible}`);

    if (finalVisible > 0) {
        console.log("\nSUKCES: Baza została zasilona materiałami MVP dla skonfigurowanego twórcy.");
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
