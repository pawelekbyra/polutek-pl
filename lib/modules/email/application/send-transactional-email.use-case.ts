import { logger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { APP_NAME } from '@/lib/constants';
import { buildContentUnsubscribeUrl, buildOneClickUnsubscribeUrl } from '@/lib/modules/subscriptions';
import { EMAIL_DEFAULTS, type SystemTemplateSlug } from '@/lib/email-defaults';
import { EMAIL_SENDER_NAME, sendEmail } from "../infrastructure/email.transport";
import { SYSTEM_TEMPLATE_DEFINITIONS } from "../domain/email-template-registry";
import { renderHtml, renderSubject } from "../domain/render-email";
import { findSystemTemplateOverride } from "./email-templates.use-cases";

export type EmailLanguage = 'pl' | 'en';

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/** One rule for every system mail: Polish only for a recipient whose stored language is Polish. */
export function resolveEmailLanguage(language: string | null | undefined): EmailLanguage {
  return language === 'pl' ? 'pl' : 'en';
}

async function findRecipient(to: string, slug: string) {
  try {
    return await prisma.user.findUnique({
      where: { email: to },
      select: { id: true, name: true, username: true, isDeleted: true },
    });
  } catch {
    logger.warn(`[email] Failed to look up the recipient of "${slug}" email`);
    return null;
  }
}

type SendTemplateEmailInput = {
  to: string;
  slug: SystemTemplateSlug;
  language: EmailLanguage;
  variables?: Record<string, string | null | undefined>;
};

/**
 * Sends a system email. The admin's saved override wins; otherwise the default from
 * lib/email-defaults.ts, the same text the admin editor shows as the default. Values are escaped
 * (HTML) or stripped of line breaks (subject); only the variables the registry defines are filled.
 */
async function sendTemplateEmail({ to, slug, language, variables = {} }: SendTemplateEmailInput) {
  const definition = SYSTEM_TEMPLATE_DEFINITIONS[slug];
  const override = await findSystemTemplateOverride({ prisma }, slug);
  const fallback = EMAIL_DEFAULTS[slug];

  const recipient = await findRecipient(to, slug);
  const activeRecipient = recipient && !recipient.isDeleted ? recipient : null;
  const unsubscribe = definition.unsubscribe && activeRecipient
    ? {
        pageUrl: buildContentUnsubscribeUrl(activeRecipient.id, APP_URL()),
        oneClickUrl: buildOneClickUnsubscribeUrl(activeRecipient.id, APP_URL()),
      }
    : null;

  const nickname = activeRecipient?.name?.trim() || activeRecipient?.username?.trim() || '';
  const values: Record<string, string> = {
    firstName: nickname || (language === 'en' ? 'there' : 'Przyjacielu'),
    ...Object.fromEntries(
      Object.entries(variables).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''),
    ),
    appName: APP_NAME,
    brandName: EMAIL_SENDER_NAME,
    appUrl: APP_URL(),
    email: to,
    // There is no preferences page; the signed unsubscribe page is where email settings live.
    preferencesLink: unsubscribe?.pageUrl ?? APP_URL(),
  };
  const allowed = Object.fromEntries(definition.variables.map((key) => [key, values[key] ?? '']));

  const source = override ?? fallback;
  const subjectTemplate = language === 'en' ? (source.subjectEn || fallback.subjectEn || source.subject) : source.subject;
  const htmlTemplate = language === 'en' ? (source.htmlEn || fallback.htmlEn || source.html) : source.html;

  const result = await sendEmail({
    to,
    subject: renderSubject(subjectTemplate, allowed),
    html: renderHtml(htmlTemplate, allowed),
    language,
    kind: slug,
    unsubscribe: unsubscribe?.oneClickUrl ? { oneClickUrl: unsubscribe.oneClickUrl } : null,
  });

  if (!result.ok) {
    logger.error(`[email] Provider failed to send "${slug}" email`, { name: result.error.name, statusCode: result.error.statusCode, hint: result.error.hint });
    throw new Error(`Email provider failed to send "${slug}" email: ${result.error.message}${result.error.hint ? ` (${result.error.hint})` : ''}`);
  }

  logger.info(`[email] Email "${slug}" sent${override ? ' (admin override)' : ''}. ID: ${result.id}`);
  return { id: result.id };
}

export async function sendWelcomeEmail(toEmail: string, language: EmailLanguage) {
  return sendTemplateEmail({ to: toEmail, slug: 'welcome-email', language });
}

export async function sendPasswordChangedEmail(toEmail: string, language: EmailLanguage) {
  return sendTemplateEmail({ to: toEmail, slug: 'password-changed', language });
}

export async function sendAccountDeletedEmail(toEmail: string, language: EmailLanguage) {
  return sendTemplateEmail({ to: toEmail, slug: 'account-deleted', language });
}

export async function sendDonationThankYouEmail(toEmail: string, amount: number, currency: string, language: EmailLanguage) {
  return sendTemplateEmail({
    to: toEmail,
    slug: 'thank-you-donation',
    variables: { amount: amount.toFixed(2), currency },
    language,
  });
}

export async function sendBecomePatronEmail(toEmail: string, amount: number, currency: string, language: EmailLanguage) {
  return sendTemplateEmail({
    to: toEmail,
    slug: 'become-patron',
    variables: { amount: amount.toFixed(2), currency },
    language,
  });
}

export async function sendVerificationEmail(toEmail: string, actionUrl: string, language: EmailLanguage) {
  return sendTemplateEmail({ to: toEmail, slug: 'verify-email', variables: { actionUrl }, language });
}

export async function sendPasswordResetEmail(toEmail: string, actionUrl: string, language: EmailLanguage) {
  return sendTemplateEmail({ to: toEmail, slug: 'reset-password', variables: { actionUrl }, language });
}

/** E-mail change, step 1: the current address approves the change to `newEmail`. */
export async function sendChangeEmailConfirmationEmail(toEmail: string, newEmail: string, actionUrl: string, language: EmailLanguage) {
  return sendTemplateEmail({ to: toEmail, slug: 'change-email-confirm', variables: { actionUrl, newEmail }, language });
}

/** E-mail change, step 2: the new address confirms itself. */
export async function sendChangeEmailVerificationEmail(toEmail: string, actionUrl: string, language: EmailLanguage) {
  return sendTemplateEmail({ to: toEmail, slug: 'change-email-verify', variables: { actionUrl }, language });
}

/** E-mail change done: notice to the old address. */
export async function sendEmailChangedEmail(toEmail: string, newEmail: string, language: EmailLanguage) {
  return sendTemplateEmail({ to: toEmail, slug: 'email-changed', variables: { newEmail }, language });
}

