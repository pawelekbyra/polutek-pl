import { logger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { APP_NAME } from '@/lib/constants';
import { buildContentUnsubscribeUrl } from '@/lib/modules/subscriptions';
import { LegacyEmailServiceProvider } from "../infrastructure/legacy-email-service-provider";
import { EMAIL_DEFAULTS, type SystemTemplateSlug } from '@/lib/email-defaults';

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function replaceTemplateVariables(value: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((result, [key, replacement]) => {
    return result.split(`{{${key}}}`).join(replacement);
  }, value);
}

async function findRecipient(to: string, slug: string) {
  try {
    return await prisma.user.findUnique({
      where: { email: to },
      select: { id: true, name: true, username: true },
    });
  } catch {
    logger.warn(`[email] Failed to look up the recipient of "${slug}" email`);
    return null;
  }
}

type SendTemplateEmailInput = {
  to: string;
  slug: SystemTemplateSlug;
  variables?: Record<string, string | null | undefined>;
  language?: string;
};

/**
 * Sends a system email. An admin-edited template in the DB wins; otherwise the default from
 * lib/email-defaults.ts — the same text the admin editor shows as the default, so what the
 * admin sees is what gets sent.
 */
async function sendTemplateEmail({ to, slug, variables = {}, language = 'pl' }: SendTemplateEmailInput) {
  const template = await prisma.emailTemplate.findUnique({
    where: { slug },
    select: { subject: true, html: true, subjectEn: true, htmlEn: true },
  });
  const fallback = EMAIL_DEFAULTS[slug];
  if (!template) {
    logger.warn(`[email] Using default template for: ${slug}`);
  }

  const recipient = await findRecipient(to, slug);
  const unsubscribeUrl = recipient ? buildContentUnsubscribeUrl(recipient.id, APP_URL()) : null;
  const firstName =
    recipient?.name?.trim().split(/\s+/)[0] ||
    recipient?.username ||
    (language === 'en' ? 'there' : 'Przyjacielu');

  const safeVariables = {
    firstName,
    ...Object.fromEntries(
      Object.entries(variables)
        .filter(([, value]) => value != null && value !== '')
        .map(([key, value]) => [key, value as string]),
    ),
    appName: APP_NAME,
    appUrl: APP_URL(),
    email: to,
    userLanguage: language,
    // There is no preferences page; the signed unsubscribe page is where email settings live.
    preferencesLink: unsubscribeUrl ?? APP_URL(),
  };

  let subjectBase = template?.subject ?? fallback.subject;
  let htmlBase = template?.html ?? fallback.html;

  if (language === 'en') {
    subjectBase = template?.subjectEn || fallback.subjectEn || subjectBase;
    htmlBase = template?.htmlEn || fallback.htmlEn || htmlBase;
  }

  const subject = replaceTemplateVariables(subjectBase, safeVariables);
  const html = replaceTemplateVariables(htmlBase, safeVariables);

  const provider = new LegacyEmailServiceProvider();
  const { data, error } = await provider.sendTransactionalEmail({ to, subject, html, unsubscribeUrl });

  if (error) {
    logger.error(`[email] Resend failed to send "${slug}" email to ${to}:`, error);
    throw new Error(`Resend failed to send "${slug}" email: ${JSON.stringify(error)}`);
  }

  logger.info(`[email] Email "${slug}" sent successfully to ${to}. ID: ${data?.id}`);
  return data;
}

export async function sendWelcomeEmail(toEmail: string, firstName?: string | null, language: string = 'pl') {
  return sendTemplateEmail({
    to: toEmail,
    slug: 'welcome-email',
    variables: { firstName },
    language,
  });
}

export async function sendPasswordChangedEmail(toEmail: string) {
  return sendTemplateEmail({ to: toEmail, slug: 'password-changed' });
}

export async function sendAccountDeletedEmail(toEmail: string) {
  return sendTemplateEmail({ to: toEmail, slug: 'account-deleted' });
}

export async function sendDonationThankYouEmail(toEmail: string, amount: number, currency: string, language?: string) {
  return sendTemplateEmail({
    to: toEmail,
    slug: 'thank-you-donation',
    variables: { amount: amount.toFixed(2), currency },
    language,
  });
}

export async function sendBecomePatronEmail(toEmail: string, amount: number, currency: string, language?: string) {
  return sendTemplateEmail({
    to: toEmail,
    slug: 'become-patron',
    variables: { amount: amount.toFixed(2), currency },
    language,
  });
}
