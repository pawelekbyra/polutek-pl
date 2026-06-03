import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_WELCOME_TEMPLATE = {
  slug: "welcome-email",
  subject: "Witaj w POLUTEK.PL, {{firstName}}!",
  html: `
    <div style="font-family: serif; color: #1a1a1a; background-color: #FDFBF7; padding: 40px; line-height: 1.6; border: 1px solid #1a1a1a;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.05em; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px;">Witaj w POLUTEK.PL</h1>
      <p>Cześć {{firstName}}!</p>
      <p>Dziękujemy za dołączenie do naszej społeczności. Od teraz masz dostęp do podstawowych funkcji platformy.</p>
      <p>Odwiedź <a href="https://polutek.pl" style="color: #3b82f6; font-weight: bold; text-decoration: none;">POLUTEK.PL</a>, aby zobaczyć najnowsze filmy.</p>
    </div>
  `,
};

async function main() {
  console.log('Ensuring welcome email template exists...');
  const template = await prisma.emailTemplate.findUnique({
    where: { slug: DEFAULT_WELCOME_TEMPLATE.slug },
  });

  if (!template) {
    await prisma.emailTemplate.create({
      data: DEFAULT_WELCOME_TEMPLATE,
    });
    console.log('Created default welcome email template.');
  } else {
    console.log('Welcome email template already exists.');
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
