import { PrismaClient, AccessTier, SystemRole } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = "pawel.perfect@gmail.com";

async function main() {
  console.log('Starting seeding...');

  // 1. Create or update the Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      role: SystemRole.ADMIN,
      name: "POLUTEK.PL",
    },
    create: {
      id: "user_admin_001", // Placeholder ID, will be synced by Clerk
      email: ADMIN_EMAIL,
      name: "POLUTEK.PL",
      role: SystemRole.ADMIN,
    },
  });

  // 2. Create the Creator profile
  const creator = await prisma.creator.upsert({
    where: { slug: 'polutek' },
    update: {
      name: 'POLUTEK.PL',
      bio: 'Oficjalna platforma POLUTEK.PL. Ekskluzywne materiały VOD i niezależne śledztwa.',
      bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
      subscribersCount: 400,
    },
    create: {
      userId: adminUser.id,
      slug: 'polutek',
      name: 'POLUTEK.PL',
      bio: 'Oficjalna platforma POLUTEK.PL. Ekskluzywne materiały VOD i niezależne śledztwa.',
      bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
      subscribersCount: 400,
      isApproved: true,
    },
  });

  // 3. Define Videos
  const videosData = [
    {
      title: 'Wuthering Heights - Kate Bush Cover',
      slug: 'wuthering-heights-cover',
      description: 'Moja interpretacja klasycznego utworu Kate Bush. Nagrane w jednym ujęciu, aby oddać surowość i emocje tej kompozycji.',
      videoUrl: 'https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/Wuthering-Heights.mp4',
      thumbnailUrl: '/wuthering.jpg',
      duration: '04:12',
      tier: AccessTier.PUBLIC,
      isMainFeatured: true,
      views: 1250400,
      likesCount: 45000,
      dislikesCount: 120,
    },
    {
      title: 'Nie masz psychy się zalogować',
      slug: 'independency-2024',
      description: 'W tym odcinku analizuję, dlaczego twórcy muszą szukać alternatywnych dróg finansowania poza wielkimi korporacjami.',
      videoUrl: 'https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/Wuthering-Heights.mp4', // Reusing asset for seed
      thumbnailUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2659&auto=format&fit=crop',
      duration: '15:30',
      tier: AccessTier.LOGGED_IN,
      isMainFeatured: false,
      views: 85000,
      likesCount: 12000,
      dislikesCount: 50,
    },
    {
      title: 'Mój setup do nagrywania śledztw',
      slug: 'setup-tour',
      description: 'Pokazuję sprzęt, którego używam do tworzenia moich materiałów. Od kamer po mikrofony i oświetlenie.',
      videoUrl: 'https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/Wuthering-Heights.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=2670&auto=format&fit=crop',
      duration: '22:15',
      tier: AccessTier.VIP1,
      isMainFeatured: false,
      views: 15000,
      likesCount: 3000,
      dislikesCount: 10,
    },
    {
      title: 'Niepublikowane materiały z ostatniego śledztwa',
      slug: 'unreleased-investigation',
      description: 'Tylko dla Patronów. Nagrania, które nie weszły do głównego materiału ze względu na ich kontrowersyjną naturę.',
      videoUrl: 'https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/Wuthering-Heights.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2670&auto=format&fit=crop',
      duration: '45:00',
      tier: AccessTier.VIP2,
      isMainFeatured: false,
      views: 5000,
      likesCount: 1500,
      dislikesCount: 5,
    },
    {
      title: 'Q&A: Odpowiedzi na Wasze najtrudniejsze pytania',
      slug: 'qa-session-1',
      description: 'Odpowiadam na pytania przesłane przez moich wspierających. Nic nie jest poza granicami.',
      videoUrl: 'https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/Wuthering-Heights.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2670&auto=format&fit=crop',
      duration: '32:10',
      tier: AccessTier.VIP1,
      isMainFeatured: false,
      views: 12000,
      likesCount: 2500,
      dislikesCount: 15,
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
        views: v.views,
        likesCount: v.likesCount,
        dislikesCount: v.dislikesCount,
        publishedAt: new Date(),
      },
    });
  }

  // 4. Define Email Templates
  const templates = [
    {
      name: 'WELCOME',
      subjectPl: 'Witaj w POLUTEK.PL!',
      bodyPl: '<h1>Siema!</h1><p>Dzięki za dołączenie do naszej społeczności. Cieszymy się, że tu jesteś.</p><p>Ekipa POLUTEK.PL</p>',
      subjectEn: 'Welcome to POLUTEK.PL!',
      bodyEn: '<h1>Hey there!</h1><p>Thanks for joining our community. We are glad to have you here.</p><p>POLUTEK.PL Team</p>'
    },
    {
      name: 'ACCOUNT_DELETED',
      subjectPl: 'Twoje konto zostało usunięte - POLUTEK.PL',
      bodyPl: '<h1>Cześć,</h1><p>Potwierdzamy, że Twoje konto w POLUTEK.PL zostało pomyślnie usunięte. Przykro nam, że odchodzisz.</p><p>Ekipa POLUTEK.PL</p>',
      subjectEn: 'Your account has been deleted - POLUTEK.PL',
      bodyEn: '<h1>Hi,</h1><p>We confirm that your account at POLUTEK.PL has been successfully deleted. We are sorry to see you go.</p><p>POLUTEK.PL Team</p>'
    },
    {
      name: 'PASSWORD_CHANGED',
      subjectPl: 'Twoje hasło zostało zmienione - POLUTEK.PL',
      bodyPl: '<h1>Cześć,</h1><p>Twoje hasło do konta POLUTEK.PL zostało właśnie zmienione. Jeśli to nie Ty, skontaktuj się z nami jak najszybciej.</p><p>Ekipa POLUTEK.PL</p>',
      subjectEn: 'Your password has been changed - POLUTEK.PL',
      bodyEn: '<h1>Hi,</h1><p>Your POLUTEK.PL account password has just been changed. If this wasn\'t you, please contact us immediately.</p><p>POLUTEK.PL Team</p>'
    },
    {
      name: 'THANK_YOU_DONATION',
      subjectPl: 'Dziękujemy za wsparcie {{amount}} {{currency}}!',
      bodyPl: '<h1>Dziękujemy za Twoje wsparcie!</h1><p>Otrzymaliśmy Twoją wpłatę w wysokości {{amount}} {{currency}}.</p><p>Dzięki Tobie możemy tworzyć więcej niezależnych materiałów.</p><p>Pozdrawiamy,<br/>Zespół POLUTEK.PL</p>',
      subjectEn: 'Thank you for your support {{amount}} {{currency}}!',
      bodyEn: '<h1>Thank you for your support!</h1><p>We have received your donation of {{amount}} {{currency}}.</p><p>Thanks to you, we can create more independent content.</p><p>Best regards,<br/>POLUTEK.PL Team</p>'
    },
    {
      name: 'BECOME_PATRON',
      subjectPl: 'Witaj w gronie Patronów POLUTEK.PL!',
      bodyPl: '<h1>Gratulacje!</h1><p>Twoje łączne wsparcie przekroczyło próg i właśnie zostałeś Patronem POLUTEK.PL.</p><p>Od teraz masz dostęp do ekskluzywnych materiałów w Strefie Patrona.</p><p>Dziękujemy za Twoje zaufanie,<br/>Zespół POLUTEK.PL</p>',
      subjectEn: 'Welcome to the Patrons of POLUTEK.PL!',
      bodyEn: '<h1>Congratulations!</h1><p>Your total support has exceeded the threshold and you have just become a Patron of POLUTEK.PL.</p><p>You now have access to exclusive content in the Patrons\' Zone.</p><p>Thank you for your trust,<br/>POLUTEK.PL Team</p>'
    }
  ];

  for (const t of templates) {
    await prisma.emailTemplate.upsert({
      where: { name: t.name },
      update: {
        subjectPl: t.subjectPl,
        bodyPl: t.bodyPl,
        subjectEn: t.subjectEn,
        bodyEn: t.bodyEn,
      },
      create: t,
    });
  }

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
