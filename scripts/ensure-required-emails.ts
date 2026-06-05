import { PrismaClient } from '@prisma/client';
import { APP_NAME } from '../lib/constants';

const prisma = new PrismaClient();

const REQUIRED_TEMPLATES = [
  {
    slug: 'welcome-email',
    subject: `Witaj w ${APP_NAME}, {{firstName}}!`,
    html: `<h1>Witaj w ${APP_NAME}</h1><p>Cześć {{firstName}}! Dziękujemy za dołączenie.</p>`,
  },
  {
    slug: 'account-deleted',
    subject: `Twoje konto zostało usunięte - ${APP_NAME}`,
    html: '<h1>Potwierdzenie usunięcia konta</h1><p>Twoje dane zostały pomyślnie usunięte.</p>',
  },
  {
    slug: 'password-changed',
    subject: `Hasło zostało zmienione - ${APP_NAME}`,
    html: '<h1>Bezpieczeństwo konta</h1><p>Twoje hasło zostało właśnie zaktualizowane.</p>',
  },
  {
    slug: 'thank-you-donation',
    subject: `Dziękujemy za wsparcie! - ${APP_NAME}`,
    html: '<h1>Wielkie dzięki!</h1><p>Otrzymaliśmy Twój napiwek w wysokości {{amount}} {{currency}}.</p>',
  },
  {
    slug: 'become-patron',
    subject: `Zostałeś Patronem! - ${APP_NAME}`,
    html: '<h1>Witaj w gronie Patronów!</h1><p>Masz teraz dostęp do ekskluzywnych materiałów.</p>',
  },
];

async function main() {
  console.log("--- ENSURING REQUIRED EMAIL TEMPLATES ---");
  try {
    for (const template of REQUIRED_TEMPLATES) {
      const existing = await prisma.emailTemplate.findUnique({
        where: { slug: template.slug },
      });

      if (!existing) {
        console.log(`Creating missing template: ${template.slug}`);
        await prisma.emailTemplate.create({
          data: template,
        });
      } else {
        console.log(`✓ Template already exists: ${template.slug}`);
      }
    }
    console.log("\n🚀 All required email templates are present in the database.");
  } catch (error) {
    console.error("\n❌ ERROR: Failed to ensure email templates:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
