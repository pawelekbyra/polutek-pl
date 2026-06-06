import { logger } from "@/lib/logger";
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { APP_NAME } from '../constants';

const WELCOME_EMAIL_SLUG = 'welcome-email';

const EMAIL_DICTIONARY: Record<string, { subject: string; html: string; subjectEn?: string; htmlEn?: string }> = {
  'account-deleted': {
    subject: `Twoje konto zostało usunięte - ${APP_NAME}`,
    html: '<h1>Potwierdzenie usunięcia konta</h1><p>Twoje dane zostały pomyślnie usunięte z naszego systemu. Będzie nam Cię brakować!</p>',
    subjectEn: `Your account has been deleted - ${APP_NAME}`,
    htmlEn: '<h1>Account Deletion Confirmed</h1><p>Your data has been successfully removed from our system. We will miss you!</p>',
  },
  'password-changed': {
    subject: `Hasło zostało zmienione - ${APP_NAME}`,
    html: '<h1>Bezpieczeństwo konta</h1><p>Twoje hasło zostało właśnie zaktualizowane. Jeśli to nie Ty, skontaktuj się z nami natychmiast.</p>',
    subjectEn: `Password changed - ${APP_NAME}`,
    htmlEn: '<h1>Account Security</h1><p>Your password has been updated. If this was not you, please contact us immediately.</p>',
  },
  'thank-you-donation': {
    subject: `Dziękujemy za wsparcie! - ${APP_NAME}`,
    html: '<h1>Wielkie dzięki!</h1><p>Otrzymaliśmy Twój napiwek w wysokości {{amount}} {{currency}}. Twoje wsparcie pozwala nam tworzyć więcej treści!</p>',
    subjectEn: `Thank you for your support! - ${APP_NAME}`,
    htmlEn: '<h1>Big Thanks!</h1><p>We received your tip of {{amount}} {{currency}}. Your support helps us create more content!</p>',
  },
  'become-patron': {
    subject: `Zostałeś Patronem! - ${APP_NAME}`,
    html: '<h1>Witaj w gronie Patronów!</h1><p>Dziękujemy za zaufanie. Otrzymaliśmy Twoje wsparcie w wysokości {{amount}} {{currency}}. Masz teraz dostęp do ekskluzywnych materiałów w Strefie Patronów.</p>',
    subjectEn: `You are now a Patron! - ${APP_NAME}`,
    htmlEn: '<h1>Welcome to the Patrons!</h1><p>Thank you for your trust. We received your support of {{amount}} {{currency}}. You now have access to exclusive materials in the Patrons\' Zone.</p>',
  },
};

let resendClient: Resend | null = null;

function getResendClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is missing. Add it to Vercel/environment variables.');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function replaceTemplateVariables(value: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((result, [key, replacement]) => {
    return result.split(`{{${key}}}`).join(replacement);
  }, value);
}

export type BroadcastRecipientInput = {
    userId?: string;
    email: string;
    name?: string;
    language?: string;
};

type SendTemplateEmailInput = {
  to: string;
  slug: string;
  variables?: Record<string, string | null | undefined>;
  fallback?: { subject: string; html: string; subjectEn?: string; htmlEn?: string };
};

async function sendTemplateEmail({ to, slug, variables = {}, fallback, language = 'pl' }: SendTemplateEmailInput & { language?: string }) {
  const template = await prisma.emailTemplate.findUnique({
    where: { slug },
    select: { subject: true, html: true, subjectEn: true, htmlEn: true },
  });

  if (!template && !fallback) {
    throw new Error(`Email template with slug "${slug}" was not found and no fallback provided.`);
  }

  if (!template && fallback) {
    logger.warn(`[EmailService] Using hardcoded fallback for template: ${slug}`);
  }

  const safeVariables = {
    ...Object.fromEntries(
        Object.entries(variables).map(([key, value]) => [key, value ?? ''])
    ),
    appName: APP_NAME,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    email: to,
    userLanguage: language,
    unsubscribeLink: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(to)}`,
    preferencesLink: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile/settings`
  };
  let subjectBase = template?.subject ?? fallback!.subject;
  let htmlBase = template?.html ?? fallback!.html;

  if (language === 'en') {
    subjectBase = template?.subjectEn || fallback?.subjectEn || subjectBase;
    htmlBase = template?.htmlEn || fallback?.htmlEn || htmlBase;
  }

  const subject = replaceTemplateVariables(subjectBase, safeVariables);
  const html = replaceTemplateVariables(htmlBase, safeVariables);

  const resend = getResendClient();
  const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;

  if (!process.env.EMAIL_FROM && process.env.NODE_ENV === 'production') {
    logger.error('[EmailService] EMAIL_FROM environment variable is NOT SET. Using fallback: ' + from);
  }

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
  });

  if (error) {
    logger.error(`[EmailService] Resend failed to send "${slug}" email to ${to}:`, error);
    throw new Error(`Resend failed to send "${slug}" email: ${JSON.stringify(error)}`);
  }

  // Auto-subscribe to audience if configured
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (audienceId) {
    try {
      await resend.contacts.create({
        email: to,
        firstName: variables?.firstName as string | undefined,
        unsubscribed: false,
        audienceId,
      });
      logger.info(`[EmailService] User ${to} synchronized with Resend audience ${audienceId}. First Name: ${variables?.firstName || 'None'}`);
    } catch (e) {
      logger.warn(`[EmailService] Failed to sync contact ${to} to audience ${audienceId}:`, e);
    }
  }

  logger.info(`[EmailService] Email "${slug}" sent successfully to ${to}. ID: ${data?.id}`);
  return data;
}

export async function sendWelcomeEmail(to: string, firstName?: string | null, language: string = 'pl') {
  const firstName_ = firstName || (language === 'en' ? 'User' : 'Użytkowniku');
  return sendTemplateEmail({
    to,
    slug: WELCOME_EMAIL_SLUG,
    variables: {
      firstName: firstName_,
      appName: APP_NAME,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
    fallback: {
      subject: language === 'en'
        ? `Welcome to ${APP_NAME}, ${firstName_}!`
        : `Witaj w ${APP_NAME}, ${firstName_}!`,
      html: language === 'en'
        ? `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
             <h1 style="font-size:24px;margin-bottom:16px">Welcome to ${APP_NAME}</h1>
             <p>Hi ${firstName_},</p>
             <p>Thanks for joining. You can now comment and rate videos.</p>
             <p>Visit <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}">${APP_NAME}</a> to get started.</p>
           </div>`
        : `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
             <h1 style="font-size:24px;margin-bottom:16px">Witaj w ${APP_NAME}</h1>
             <p>Cześć ${firstName_},</p>
             <p>Dziękujemy za dołączenie. Możesz teraz komentować i oceniać materiały.</p>
             <p>Odwiedź <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}">${APP_NAME}</a>, aby zacząć.</p>
           </div>`,
    },
    language,
  });
}

export class EmailService {
  static async sendWelcomeEmail(toEmail: string, firstName?: string | null, language: string = 'pl') {
    return sendWelcomeEmail(toEmail, firstName, language);
  }

  static async sendBroadcast(broadcastId: string) {
    const broadcast = await prisma.broadcastEmail.findUnique({
        where: { id: broadcastId },
        include: {
            recipients: { where: { status: 'PENDING' } }
        }
    });

    if (!broadcast) throw new Error(`Broadcast ${broadcastId} not found`);

    await prisma.broadcastEmail.update({
        where: { id: broadcastId },
        data: { status: 'SENDING' }
    });

    const resend = getResendClient();
    const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Batching logic: 50 at a time to be safe with Resend rate limits
    const batchSize = 50;
    const recipients = broadcast.recipients;

    for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        await Promise.all(batch.map(async (recipient) => {
            // Check preferences
            const pref = await prisma.emailPreference.findUnique({ where: { email: recipient.email } });
            if (pref && !pref.marketingEmails) {
                await prisma.broadcastEmailRecipient.update({
                    where: { id: recipient.id },
                    data: { status: 'SKIPPED', error: 'User opted out of marketing emails' }
                });
                return;
            }

            const subject = recipient.language === 'en' ? broadcast.subjectEn : broadcast.subjectPl;
            const htmlBase = recipient.language === 'en' ? broadcast.htmlEn : broadcast.htmlPl;

            const vars = {
                firstName: recipient.email.split('@')[0], // Fallback if no name
                name: recipient.email.split('@')[0],
                email: recipient.email,
                appName: APP_NAME,
                appUrl,
                unsubscribeLink: `${appUrl}/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
                preferencesLink: `${appUrl}/profile/settings`,
                userLanguage: recipient.language
            };

            const html = replaceTemplateVariables(htmlBase, vars);

            try {
                const { data, error } = await resend.emails.send({
                    from,
                    to: [recipient.email],
                    subject,
                    html,
                    headers: {
                        'X-Broadcast-Id': broadcastId,
                        'X-Recipient-Id': recipient.id
                    }
                });

                if (error) throw error;

                await prisma.broadcastEmailRecipient.update({
                    where: { id: recipient.id },
                    data: {
                        resendEmailId: data?.id,
                        status: 'SENT',
                        sentAt: new Date()
                    }
                });
            } catch (e: any) {
                logger.error(`[EmailService] Failed to send broadcast to ${recipient.email}`, e);
                await prisma.broadcastEmailRecipient.update({
                    where: { id: recipient.id },
                    data: { status: 'FAILED', error: e.message || 'Unknown error' }
                });
            }
        }));

        // Brief delay between batches
        if (i + batchSize < recipients.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Final status update
    const stats = await prisma.broadcastEmailRecipient.groupBy({
        by: ['status'],
        where: { broadcastEmailId: broadcastId },
        _count: true
    });

    const counts = Object.fromEntries(stats.map(s => [s.status, s._count]));
    const totalFailed = (counts['FAILED'] || 0) + (counts['BOUNCED'] || 0);

    await prisma.broadcastEmail.update({
        where: { id: broadcastId },
        data: {
            status: totalFailed > 0 ? 'PARTIAL_FAILED' : 'SENT',
            sentAt: new Date(),
            sentCount: counts['SENT'] || 0,
            errorCount: totalFailed
        }
    });
  }

  static async sendAccountDeletedEmail(toEmail: string) {
    return sendTemplateEmail({
      to: toEmail,
      slug: 'account-deleted',
      fallback: EMAIL_DICTIONARY['account-deleted'],
    });
  }

  static async sendPasswordChangedEmail(toEmail: string) {
    return sendTemplateEmail({
      to: toEmail,
      slug: 'password-changed',
      fallback: EMAIL_DICTIONARY['password-changed'],
    });
  }

  static async sendDonationThankYouEmail(toEmail: string, amount: number, currency: string, language?: string) {
    return sendTemplateEmail({
      to: toEmail,
      slug: 'thank-you-donation',
      variables: {
        amount: amount.toFixed(2),
        currency,
      },
      fallback: EMAIL_DICTIONARY['thank-you-donation'],
      language,
    });
  }

  static async sendBecomePatronEmail(toEmail: string, amount: number, currency: string, language?: string) {
    return sendTemplateEmail({
      to: toEmail,
      slug: 'become-patron',
      variables: {
        amount: amount.toFixed(2),
        currency,
      },
      fallback: EMAIL_DICTIONARY['become-patron'],
      language,
    });
  }
}
