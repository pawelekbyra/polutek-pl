import { EmailProvider } from "../domain/email-provider";
import { Resend } from "resend";
import { APP_NAME } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { flags } from "@/lib/feature-flags";
import { buildContentUnsubscribeUrl } from "@/lib/modules/subscriptions";

function replaceTemplateVariables(value: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((result, [key, replacement]) => {
    return result.split(`{{${key}}}`).join(replacement);
  }, value);
}

export class LegacyEmailServiceProvider implements EmailProvider {
  private resendClient: Resend | null = null;

  private getResendClient() {
    if (!this.resendClient) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error('RESEND_API_KEY is missing');
      }
      this.resendClient = new Resend(apiKey);
    }
    return this.resendClient;
  }

  async sendTransactionalEmail(input: { to: string; subject: string; html: string }) {
    const resend = this.getResendClient();
    const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;

    if (!process.env.EMAIL_FROM && process.env.NODE_ENV === 'production') {
      logger.error('[email] EMAIL_FROM environment variable is NOT SET. Using fallback: ' + from);
    }

    return resend.emails.send({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    });
  }

  async sendBroadcast(input: {
    subject: string;
    body: string;
    recipients: Array<{ email: string; name?: string | null; language: string }>;
    broadcastId: string;
  }) {
    const broadcastId = input.broadcastId;
    const broadcast = await prisma.broadcastEmail.findUnique({
      where: { id: broadcastId },
      include: { recipients: { where: { status: 'PENDING' } } }
    });

    if (!broadcast) throw new Error(`Broadcast ${broadcastId} not found`);

    await prisma.broadcastEmail.update({ where: { id: broadcastId }, data: { status: 'SENDING' } });

    const resend = this.getResendClient();
    const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const batchSize = 50;
    const recipients = broadcast.recipients;

    const mainCreatorSlug = flags.mainCreatorSlug;
    const mainCreator = mainCreatorSlug ? await prisma.creator.findUnique({
      where: { slug: mainCreatorSlug },
      select: { id: true }
    }) : null;
    const allEmails = recipients.map(r => r.email);
    const userIds = recipients.map(r => r.userId).filter((id): id is string => !!id);
    const allPrefs = await prisma.emailPreference.findMany({
      where: { email: { in: allEmails } },
      select: { email: true, marketingEmails: true }
    });
    const prefMap = new Map(allPrefs.map(p => [p.email, p.marketingEmails]));
    const activeSubscriptions = mainCreator
      ? await prisma.subscription.findMany({
          where: { creatorId: mainCreator.id, userId: { in: userIds } },
          select: { userId: true }
        })
      : [];
    const activeSubscriptionUserIds = new Set(activeSubscriptions.map(s => s.userId));

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      await Promise.all(batch.map(async (recipient) => {
        if (!recipient.userId || !activeSubscriptionUserIds.has(recipient.userId)) {
          await prisma.broadcastEmailRecipient.update({
            where: { id: recipient.id },
            data: { status: 'SKIPPED', error: 'NO_VERIFIABLE_CONTENT_OPT_IN' }
          });
          return;
        }

        const marketingEmailsEnabled = prefMap.get(recipient.email);
        if (marketingEmailsEnabled !== true) {
          await prisma.broadcastEmailRecipient.update({
            where: { id: recipient.id },
            data: { status: 'SKIPPED', error: 'CONTENT_NOTIFICATIONS_OPTED_OUT' }
          });
          return;
        }

        const subject = recipient.language === 'en' ? broadcast.subjectEn : broadcast.subjectPl;
        const htmlBase = recipient.language === 'en' ? broadcast.htmlEn : broadcast.htmlPl;

        const unsubscribeLink = recipient.userId ? buildContentUnsubscribeUrl(recipient.userId, appUrl) : null;
        if (!unsubscribeLink) {
          await prisma.broadcastEmailRecipient.update({
            where: { id: recipient.id },
            data: { status: 'SKIPPED', error: 'UNSUBSCRIBE_LINK_UNAVAILABLE' }
          });
          return;
        }

        const vars = {
          firstName: recipient.email.split('@')[0],
          name: recipient.email.split('@')[0],
          email: recipient.email,
          appName: APP_NAME,
          appUrl,
          unsubscribeLink,
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
            data: { resendEmailId: data?.id, status: 'SENT', sentAt: new Date() }
          });
        } catch (e: any) {
          logger.error('[LegacyEmailServiceProvider] Failed to send broadcast recipient', { broadcastId, recipientId: recipient.id });
          await prisma.broadcastEmailRecipient.update({
            where: { id: recipient.id },
            data: { status: 'FAILED', error: e.message || 'Unknown error' }
          });
        }
      }));

      if (i + batchSize < recipients.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

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

    return {
      sent: counts['SENT'] || 0,
      failed: totalFailed,
      messageIds: [],
    };
  }

  async sendTestEmail(input: { to: string; subject: string; body: string }) {
    try {
      const resend = this.getResendClient();
      const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;

      const { data, error } = await resend.emails.send({
        from,
        to: [input.to],
        subject: `[TEST] ${input.subject}`,
        html: input.body
      });

      if (error) throw error;

      return { messageId: data?.id || "unknown-id" };
    } catch (err: any) {
      logger.error("[LegacyEmailServiceProvider] Failed to send test email", err);
      throw err;
    }
  }
}
