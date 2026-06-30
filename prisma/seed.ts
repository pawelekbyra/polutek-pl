import { PrismaClient, AccessTier, SystemRole, VideoStatus } from '@prisma/client';
import { ensureRequiredEmailTemplates } from '../scripts/ensure-required-emails';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.local";
const MAIN_CREATOR_SLUG = process.env.MAIN_CREATOR_SLUG || "polutek";
const MAIN_CREATOR_NAME = process.env.MAIN_CREATOR_NAME || "Configured Creator";

async function main() {
  console.log(`Starting seeding for ${MAIN_CREATOR_NAME} MVP...`);

  // 1. Create or update the Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      role: SystemRole.ADMIN,
      name: MAIN_CREATOR_NAME,
    },
    create: {
      id: "user_admin_001",
      email: ADMIN_EMAIL,
      name: MAIN_CREATOR_NAME,
      role: SystemRole.ADMIN,
    },
  });

  // 2. Create the Creator profile
  const creator = await prisma.creator.upsert({
    where: { slug: MAIN_CREATOR_SLUG },
    update: {
      name: MAIN_CREATOR_NAME,
      bio: `Oficjalny kanał ${MAIN_CREATOR_NAME}. Ekskluzywne materiały VOD i niezależne treści.`,
      subscribersCount: 1250000,
      isApproved: true,
      isPrimary: true,
    },
    create: {
      userId: adminUser.id,
      slug: MAIN_CREATOR_SLUG,
      name: MAIN_CREATOR_NAME,
      bio: `Oficjalny kanał ${MAIN_CREATOR_NAME}. Ekskluzywne materiały VOD i niezależne treści.`,
      subscribersCount: 1250000,
      isApproved: true,
      isPrimary: true,
    },
  });

  // 3. Define Videos
  const videosData = [
    {
      title: "You don't have the guts to log in",
      slug: 'wuthering-heights-cover',
      description: 'Moja interpretacja klasycznego utworu Kate Bush. Nagrane w jednym ujęciu, aby oddać surowość i emocje tej kompozycji.',
      videoUrl: "https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/Wuthering-Heights.mp4",
      thumbnailUrl: '/wuthering.jpg',
      duration: '04:12',
      tier: AccessTier.PUBLIC,
      isMainFeatured: true,
      views: 1250400,
      likesCount: 45000,
      dislikesCount: 120,
    },
    {
      title: 'Materiał dla zalogowanych',
      slug: 'historia-powstania-osady',
      description: 'Materiał o historii powstania osady.',
      videoUrl: "https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/historia-powstania-osady-natury-zew-w-gruncie-ruchu-stefan.mp4",
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
      duration: '10:00',
      tier: AccessTier.LOGGED_IN,
      isMainFeatured: false,
      views: 85000,
      likesCount: 12000,
      dislikesCount: 50,
    },
    {
      title: 'Udało się!!!',
      slug: 'intencja-swiadomosc-sprawczosci',
      description: 'Q&A z Michałem Kicińskim z Festiwalu Wibracje.',
      videoUrl: "https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/intencja-swiadomosc-sprawczosci-michal-kicinski-qa-festiwal-wibracje.mp4",
      thumbnailUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2659&auto=format&fit=crop',
      duration: '15:30',
      tier: AccessTier.PATRON,
      isMainFeatured: false,
      views: 15000,
      likesCount: 3000,
      dislikesCount: 10,
    }
  ];

  for (const v of videosData) {
    await prisma.video.upsert({
      where: { slug: v.slug },
      update: {
        title: v.title,
        description: v.description,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        tier: v.tier,
        isMainFeatured: v.isMainFeatured,
        views: v.views,
        likesCount: v.likesCount,
        dislikesCount: v.dislikesCount,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      create: {
        creatorId: creator.id,
        title: v.title,
        slug: v.slug,
        description: v.description,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        tier: v.tier,
        isMainFeatured: v.isMainFeatured,
        status: VideoStatus.PUBLISHED,
        views: v.views,
        likesCount: v.likesCount,
        dislikesCount: v.dislikesCount,
        publishedAt: new Date(),
      },
    });
  }

  await ensureRequiredEmailTemplates(prisma.emailTemplate);
  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
