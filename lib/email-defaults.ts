import { APP_NAME } from './constants';

export const SYSTEM_TEMPLATE_SLUGS = [
  'welcome-email',
  'become-patron',
  'thank-you-donation',
  'password-changed',
  'account-deleted'
] as const;

export type SystemTemplateSlug = typeof SYSTEM_TEMPLATE_SLUGS[number];

export const EMAIL_DEFAULTS: Record<SystemTemplateSlug, { subject: string; html: string; subjectEn: string; htmlEn: string }> = {
  'welcome-email': {
    subject: 'Witaj w {{appName}}, {{firstName}}!',
    subjectEn: 'Welcome to {{appName}}, {{firstName}}!',
    html: `
      <div style="font-family: serif; color: #1a1a1a; background-color: #FDFBF7; padding: 40px; line-height: 1.6; border: 1px solid #1a1a1a;">
        <h1 style="text-transform: uppercase; letter-spacing: -0.05em; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px;">Witaj w {{appName}}</h1>
        <p>Cześć {{firstName}}!</p>
        <p>Dziękujemy za dołączenie do naszej społeczności. Od teraz masz dostęp do podstawowych funkcji platformy, takich jak komentowanie i ocenianie materiałów.</p>
        <p>Jeśli chcesz odblokować dostęp do <strong>Strefy Patrona</strong> i oglądać ekskluzywne materiały, możesz wesprzeć projekt dowolnym napiwkiem.</p>
        <p>Odwiedź <a href="{{appUrl}}" style="color: #3b82f6; font-weight: bold; text-decoration: none;">{{appName}}</a>, aby zobaczyć najnowsze filmy.</p>
        <br />
        <p style="font-style: italic; border-top: 1px solid #1a1a1a; padding-top: 16px;">Pozdrawiamy,<br />Zespół {{appName}}</p>
      </div>
    `,
    htmlEn: `
      <div style="font-family: serif; color: #1a1a1a; background-color: #FDFBF7; padding: 40px; line-height: 1.6; border: 1px solid #1a1a1a;">
        <h1 style="text-transform: uppercase; letter-spacing: -0.05em; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px;">Welcome to {{appName}}</h1>
        <p>Hi {{firstName}}!</p>
        <p>Thank you for joining our community. You now have access to basic platform features like commenting and rating videos.</p>
        <p>If you want to unlock access to the <strong>Patron Zone</strong> and watch exclusive materials, you can support the project with any tip.</p>
        <p>Visit <a href="{{appUrl}}" style="color: #3b82f6; font-weight: bold; text-decoration: none;">{{appName}}</a> to see the latest videos.</p>
        <br />
        <p style="font-style: italic; border-top: 1px solid #1a1a1a; padding-top: 16px;">Best regards,<br />The {{appName}} Team</p>
      </div>
    `
  },
  'account-deleted': {
    subject: `Twoje konto zostało usunięte - ${APP_NAME}`,
    subjectEn: `Your account has been deleted - ${APP_NAME}`,
    html: '<h1>Potwierdzenie usunięcia konta</h1><p>Twoje dane zostały pomyślnie usunięte z naszego systemu. Będzie nam Cię brakować!</p>',
    htmlEn: '<h1>Account Deletion Confirmed</h1><p>Your data has been successfully removed from our system. We will miss you!</p>',
  },
  'password-changed': {
    subject: `Hasło zostało zmienione - ${APP_NAME}`,
    subjectEn: `Password changed - ${APP_NAME}`,
    html: '<h1>Bezpieczeństwo konta</h1><p>Twoje hasło zostało właśnie zaktualizowane. Jeśli to nie Ty, skontaktuj się z nami natychmiast.</p>',
    htmlEn: '<h1>Account Security</h1><p>Your password has been updated. If this was not you, please contact us immediately.</p>',
  },
  'thank-you-donation': {
    subject: `Dziękujemy za wsparcie! - ${APP_NAME}`,
    subjectEn: `Thank you for your support! - ${APP_NAME}`,
    html: '<h1>Wielkie dzięki!</h1><p>Otrzymaliśmy Twój napiwek w wysokości {{amount}} {{currency}}. Twoje wsparcie pozwala nam tworzyć więcej treści!</p>',
    htmlEn: '<h1>Big Thanks!</h1><p>We received your tip of {{amount}} {{currency}}. Your support helps us create more content!</p>',
  },
  'become-patron': {
    subject: `Zostałeś Patronem! - ${APP_NAME}`,
    subjectEn: `You are now a Patron! - ${APP_NAME}`,
    html: '<h1>Witaj w gronie Patronów!</h1><p>Dziękujemy za zaufanie. Otrzymaliśmy Twoje wsparcie w wysokości {{amount}} {{currency}}. Masz teraz dostęp do ekskluzywnych materiałów w Strefie Patronów.</p>',
    htmlEn: '<h1>Welcome to the Patrons!</h1><p>Thank you for your trust. We received your support of {{amount}} {{currency}}. You now have access to exclusive materials in the Patrons\' Zone.</p>',
  },
};
