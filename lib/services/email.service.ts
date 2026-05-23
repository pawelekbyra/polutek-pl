import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

let resendClient: Resend | null = null;

function getResendClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[EmailService] RESEND_API_KEY is missing. Emails will not be sent.');
      return null;
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const EMAIL_DICTIONARY: Record<string, {
    pl: { subject: string, html: string },
    en: { subject: string, html: string }
}> = {
  WELCOME: {
    pl: {
      subject: 'Witaj w POLUTEK.PL!',
      html: '<h1>Siema!</h1><p>Dzięki za dołączenie do naszej społeczności. Cieszymy się, że tu jesteś!</p>'
    },
    en: {
      subject: 'Welcome to POLUTEK.PL!',
      html: '<h1>Hey!</h1><p>Thanks for joining our community. We are glad to have you here!</p>'
    }
  },
  ACCOUNT_DELETED: {
    pl: {
      subject: 'Twoje konto zostało usunięte - POLUTEK.PL',
      html: '<h1>Potwierdzenie usunięcia konta</h1><p>Twoje dane zostały pomyślnie usunięte z naszego systemu. Będzie nam Cię brakować!</p>'
    },
    en: {
      subject: 'Your account has been deleted - POLUTEK.PL',
      html: '<h1>Account Deletion Confirmation</h1><p>Your data has been successfully removed from our system. We will miss you!</p>'
    }
  },
  PASSWORD_CHANGED: {
    pl: {
      subject: 'Hasło zostało zmienione - POLUTEK.PL',
      html: '<h1>Bezpieczeństwo konta</h1><p>Twoje hasło zostało właśnie zaktualizowane. Jeśli to nie Ty, skontaktuj się z nami natychmiast.</p>'
    },
    en: {
      subject: 'Password Changed - POLUTEK.PL',
      html: '<h1>Account Security</h1><p>Your password has just been updated. If this was not you, please contact us immediately.</p>'
    }
  },
  THANK_YOU_DONATION: {
    pl: {
      subject: 'Dziękujemy za wsparcie! - POLUTEK.PL',
      html: '<h1>Wielkie dzięki!</h1><p>Otrzymaliśmy Twój napiwek w wysokości {{amount}} {{currency}}. Twoje wsparcie pozwala nam tworzyć więcej treści!</p>'
    },
    en: {
      subject: 'Thank you for your support! - POLUTEK.PL',
      html: '<h1>Big thanks!</h1><p>We received your tip of {{amount}} {{currency}}. Your support allows us to create more content!</p>'
    }
  },
  BECOME_PATRON: {
    pl: {
      subject: 'Zostałeś Patronem! - POLUTEK.PL',
      html: '<h1>Witaj w gronie Patronów!</h1><p>Dziękujemy za zaufanie. Masz teraz dostęp do ekskluzywnych materiałów w Strefie Patronów.</p>'
    },
    en: {
      subject: 'You are now a Patron! - POLUTEK.PL',
      html: '<h1>Welcome to the Patrons circle!</h1><p>Thank you for your trust. You now have access to exclusive materials in the Patrons Zone.</p>'
    }
  }
};

export class EmailService {
  private static async sendEmail(toEmail: string, templateName: string, language: 'pl' | 'en' = 'pl', variables?: Record<string, string>) {
    console.log(`[EmailService] Attempting to send ${templateName} to ${toEmail} (${language})`);
    try {
      const resend = getResendClient();
      if (!resend) {
        console.warn('[EmailService] Resend client not available. Aborting send.');
        return;
      }

      let template = null;
      try {
        template = await prisma.emailTemplate.findUnique({
          where: { name: templateName }
        });
      } catch (dbError) {
        console.error(`[EmailService] DB error fetching ${templateName} template:`, dbError);
      }

      let subject: string;
      let html: string;

      if (!template) {
        console.warn(`[EmailService] ${templateName} template not found in DB. Using dictionary fallback.`);
        const fallback = EMAIL_DICTIONARY[templateName];
        if (fallback) {
          subject = language === 'pl' ? fallback.pl.subject : fallback.en.subject;
          html = language === 'pl' ? fallback.pl.html : fallback.en.html;
        } else {
          console.warn(`[EmailService] No fallback found for ${templateName}. Skipping.`);
          return;
        }
      } else {
        subject = language === 'pl' ? template.subjectPl : template.subjectEn;
        html = language === 'pl' ? template.bodyPl : template.bodyEn;
      }

      // Simple variable replacement
      if (variables) {
        Object.entries(variables).forEach(([key, value]) => {
          const placeholder = new RegExp(`{{${key}}}`, 'g');
          subject = subject.replace(placeholder, value);
          html = html.replace(placeholder, value);
        });
      }

      const { data, error } = await resend.emails.send({
        from: 'POLUTEK.PL <no-reply@polutek.pl>',
        to: [toEmail],
        subject: subject,
        html: html,
      });

      if (error) {
        console.error(`[EmailService] Error sending ${templateName} email via Resend:`, error);
      } else {
        console.log(`[EmailService] ${templateName} email sent to ${toEmail} (${language})`);
      }
    } catch (e) {
      console.error(`[EmailService] Unexpected error sending ${templateName} email:`, e);
    }
  }

  static async sendWelcomeEmail(toEmail: string, language: 'pl' | 'en' = 'pl') {
    await this.sendEmail(toEmail, 'WELCOME', language);
  }

  static async sendAccountDeletedEmail(toEmail: string, language: 'pl' | 'en' = 'pl') {
    await this.sendEmail(toEmail, 'ACCOUNT_DELETED', language);
  }

  static async sendPasswordChangedEmail(toEmail: string, language: 'pl' | 'en' = 'pl') {
    await this.sendEmail(toEmail, 'PASSWORD_CHANGED', language);
  }

  static async sendDonationThankYouEmail(toEmail: string, amount: number, currency: string, language: 'pl' | 'en' = 'pl') {
    await this.sendEmail(toEmail, 'THANK_YOU_DONATION', language, {
      amount: amount.toFixed(2),
      currency: currency
    });
  }

  static async sendBecomePatronEmail(toEmail: string, language: 'pl' | 'en' = 'pl') {
    await this.sendEmail(toEmail, 'BECOME_PATRON', language);
  }
}
