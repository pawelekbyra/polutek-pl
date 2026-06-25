import { PrismaClient } from '@prisma/client';
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS, SystemTemplateSlug } from '../lib/email-defaults';

type EmailTemplateClient = Pick<PrismaClient['emailTemplate'], 'findUnique' | 'create'>;

const TEMPLATE_METADATA: Record<SystemTemplateSlug, { name: string; description: string; category: 'SYSTEM' | 'WELCOME' | 'PAYMENT' | 'PATRON' }> = {
  'welcome-email': {
    name: 'System: Welcome email',
    description: 'Systemowy email powitalny wysyłany po utworzeniu konta.',
    category: 'WELCOME',
  },
  'account-deleted': {
    name: 'System: Account deleted',
    description: 'Systemowe potwierdzenie usunięcia konta.',
    category: 'SYSTEM',
  },
  'password-changed': {
    name: 'System: Password changed',
    description: 'Systemowe powiadomienie o zmianie hasła.',
    category: 'SYSTEM',
  },
  'thank-you-donation': {
    name: 'System: Thank you donation',
    description: 'Systemowe podziękowanie za wsparcie poniżej progu patrona.',
    category: 'PAYMENT',
  },
  'become-patron': {
    name: 'System: Become patron',
    description: 'Systemowe potwierdzenie przyznania dostępu patrona.',
    category: 'PATRON',
  },
};

export async function ensureRequiredEmailTemplates(emailTemplate: EmailTemplateClient) {
  const created: string[] = [];
  const existing: string[] = [];

  for (const slug of SYSTEM_TEMPLATE_SLUGS) {
    const currentTemplate = await emailTemplate.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (currentTemplate) {
      existing.push(slug);
      continue;
    }

    await emailTemplate.create({
      data: {
        slug,
        ...TEMPLATE_METADATA[slug],
        ...EMAIL_DEFAULTS[slug],
        isSystem: true,
        isActive: true,
      },
    });
    created.push(slug);
  }

  return { created, existing };
}

async function main() {
  console.log('--- ENSURING REQUIRED EMAIL TEMPLATES ---');
  const prisma = new PrismaClient();

  try {
    const result = await ensureRequiredEmailTemplates(prisma.emailTemplate);

    for (const slug of result.created) {
      console.log(`Created missing template: ${slug}`);
    }
    for (const slug of result.existing) {
      console.log(`✓ Template already exists: ${slug}`);
    }

    console.log('\n🚀 All required email templates are present in the database.');
  } catch (error) {
    console.error('\n❌ ERROR: Failed to ensure email templates:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
