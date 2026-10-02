export const SYSTEM_TEMPLATE_SLUGS = [
  'welcome-email',
  'become-patron',
  'thank-you-donation',
  'password-changed',
  'account-deleted',
  'verify-email',
  'reset-password'
] as const;

export type SystemTemplateSlug = typeof SYSTEM_TEMPLATE_SLUGS[number];

const BASE_STYLE = `
  font-family: Georgia, 'Times New Roman', serif;
  color: #1a1a1a;
  background-color: #FDFBF7;
  max-width: 600px;
  margin: 0 auto;
  padding: 48px 40px;
  line-height: 1.7;
  border: 1px solid #d4c9b0;
`.trim().replace(/\n\s+/g, ' ');

// No text-transform: an all-caps headline and button are a spam signal (the Hotmail Junk incident,
// 2026-10-02, docs/operations/EMAIL_DELIVERABILITY.md).
const HEADER_STYLE = `
  font-size: 26px;
  font-weight: bold;
  border-bottom: 2px solid #1a1a1a;
  padding-bottom: 16px;
  margin-top: 0;
  margin-bottom: 24px;
`.trim().replace(/\n\s+/g, ' ');

const FOOTER_STYLE = `
  font-size: 12px;
  color: #888;
  border-top: 1px solid #d4c9b0;
  padding-top: 20px;
  margin-top: 40px;
`.trim().replace(/\n\s+/g, ' ');

const BUTTON_STYLE = `
  display: inline-block;
  background-color: #FFEA00;
  color: #1a1a1a;
  text-decoration: none;
  font-weight: bold;
  font-family: Georgia, serif;
  font-size: 14px;
  padding: 12px 32px;
  border: 2px solid #1a1a1a;
  margin: 20px 0;
`.trim().replace(/\n\s+/g, ' ');

const HIGHLIGHT_BOX_STYLE = `
  background-color: #FFEA00;
  border: 1px solid #1a1a1a;
  padding: 20px 24px;
  margin: 24px 0;
`.trim().replace(/\n\s+/g, ' ');

const INFO_BOX_STYLE = `
  background-color: #f5f0e8;
  border-left: 3px solid #1a1a1a;
  padding: 16px 20px;
  margin: 24px 0;
  font-size: 14px;
`.trim().replace(/\n\s+/g, ' ');

export const EMAIL_DEFAULTS: Record<SystemTemplateSlug, { subject: string; html: string; subjectEn: string; htmlEn: string }> = {
  'welcome-email': {
    // No user-chosen nickname in a subject (it can be anything) and no exclamation marks.
    subject: 'Witaj w {{brandName}}',
    subjectEn: 'Welcome to {{brandName}}',
    html: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Witaj, {{firstName}}!</h1>

  <p style="font-size: 16px;">Cieszę się, że tu jesteś. Właśnie dołączyłeś/-aś do społeczności <strong>{{brandName}}</strong> — miejsca, gdzie tworzę niezależne treści wideo dla ludzi takich jak Ty.</p>

  <div style="${INFO_BOX_STYLE}">
    <strong>Co masz teraz dostępne:</strong><br/>
    ✓ Wszystkie filmy — bez opłat<br/>
    ✓ Komentowanie i reagowanie na filmy
  </div>

  <a href="{{appUrl}}" style="${BUTTON_STYLE}">Przejdź do {{brandName}} →</a>

  <p style="font-size: 14px; color: #555;">Jeśli masz pytania lub cokolwiek nie działa, odpowiedz bezpośrednio na tego maila.</p>

  <p style="${FOOTER_STYLE}">
    Ten email został wysłany na adres {{email}} po założeniu konta w {{brandName}}.<br/>
    <a href="{{preferencesLink}}" style="color: #888;">Zarządzaj preferencjami email</a>
  </p>
</div>`,
    htmlEn: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Welcome, {{firstName}}!</h1>

  <p style="font-size: 16px;">I'm glad you're here. You've just joined the <strong>{{brandName}}</strong> community — a place where I create independent video content for people like you.</p>

  <div style="${INFO_BOX_STYLE}">
    <strong>What you have access to now:</strong><br/>
    ✓ Every video — free of charge<br/>
    ✓ Commenting and reacting to videos
  </div>

  <a href="{{appUrl}}" style="${BUTTON_STYLE}">Go to {{brandName}} →</a>

  <p style="font-size: 14px; color: #555;">If you have any questions or something isn't working, reply directly to this email.</p>

  <p style="${FOOTER_STYLE}">
    This email was sent to {{email}} after creating an account at {{brandName}}.<br/>
    <a href="{{preferencesLink}}" style="color: #888;">Manage email preferences</a>
  </p>
</div>`,
  },

  'become-patron': {
    subject: 'Dziękuję za wsparcie',
    subjectEn: 'Thank you for your support',
    html: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Dziękuję, {{firstName}}!</h1>

  <p style="font-size: 16px;">Twoje wsparcie dotarło. To dla mnie wiele znaczy i pozwala kontynuować tworzenie niezależnych treści.</p>

  <div style="${HIGHLIGHT_BOX_STYLE}">
    <strong style="font-size: 18px;">Napiwek: {{amount}} {{currency}}</strong><br/>
    <span style="font-size: 13px; opacity: 0.7;">Otrzymano i zaksięgowano</span>
  </div>

  <p style="font-size: 14px; color: #555;">Wsparcie jest dobrowolnym napiwkiem i niczego nie odblokowuje — wszystkie filmy są dostępne dla każdego zalogowanego. Po prostu dziękuję.</p>

  <a href="{{appUrl}}" style="${BUTTON_STYLE}">Wróć do {{brandName}} →</a>

  <p style="${FOOTER_STYLE}">
    Ten email dotyczył transakcji na koncie {{email}} w {{brandName}}.<br/>
    <a href="{{preferencesLink}}" style="color: #888;">Zarządzaj preferencjami email</a>
  </p>
</div>`,
    htmlEn: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Thank you, {{firstName}}!</h1>

  <p style="font-size: 16px;">Your support has arrived. It means a lot to me and helps me continue creating independent content.</p>

  <div style="${HIGHLIGHT_BOX_STYLE}">
    <strong style="font-size: 18px;">Tip: {{amount}} {{currency}}</strong><br/>
    <span style="font-size: 13px; opacity: 0.7;">Received and recorded</span>
  </div>

  <p style="font-size: 14px; color: #555;">Your support is a voluntary tip and unlocks nothing — every video is available to anyone who signs in. Simply: thank you.</p>

  <a href="{{appUrl}}" style="${BUTTON_STYLE}">Back to {{brandName}} →</a>

  <p style="${FOOTER_STYLE}">
    This email relates to a transaction on account {{email}} at {{brandName}}.<br/>
    <a href="{{preferencesLink}}" style="color: #888;">Manage email preferences</a>
  </p>
</div>`,
  },

  'thank-you-donation': {
    subject: 'Dziękuję za wsparcie',
    subjectEn: 'Thank you for your support',
    html: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Wielkie dzięki, {{firstName}}!</h1>

  <p style="font-size: 16px;">Otrzymałem Twój napiwek. Każde wsparcie pozwala mi inwestować czas w tworzenie kolejnych materiałów.</p>

  <div style="${HIGHLIGHT_BOX_STYLE}">
    <strong style="font-size: 18px;">Napiwek: {{amount}} {{currency}}</strong><br/>
    <span style="font-size: 13px; opacity: 0.7;">Otrzymano i zaksięgowano</span>
  </div>

  <a href="{{appUrl}}" style="${BUTTON_STYLE}">Wróć do {{brandName}} →</a>

  <p style="${FOOTER_STYLE}">
    Ten email dotyczył transakcji na koncie {{email}} w {{brandName}}.<br/>
    <a href="{{preferencesLink}}" style="color: #888;">Zarządzaj preferencjami email</a>
  </p>
</div>`,
    htmlEn: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Big thanks, {{firstName}}!</h1>

  <p style="font-size: 16px;">I received your tip. Every bit of support allows me to invest time in creating more content.</p>

  <div style="${HIGHLIGHT_BOX_STYLE}">
    <strong style="font-size: 18px;">Tip: {{amount}} {{currency}}</strong><br/>
    <span style="font-size: 13px; opacity: 0.7;">Received and recorded</span>
  </div>

  <a href="{{appUrl}}" style="${BUTTON_STYLE}">Back to {{brandName}} →</a>

  <p style="${FOOTER_STYLE}">
    This email relates to a transaction on account {{email}} at {{brandName}}.<br/>
    <a href="{{preferencesLink}}" style="color: #888;">Manage email preferences</a>
  </p>
</div>`,
  },

  'password-changed': {
    subject: 'Hasło zostało zmienione',
    subjectEn: 'Your password was changed',
    html: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Hasło zmienione</h1>

  <p style="font-size: 16px;">Twoje hasło do konta <strong>{{brandName}}</strong> zostało właśnie zaktualizowane.</p>

  <div style="${INFO_BOX_STYLE}">
    <strong>Jeśli to nie Ty zmieniłeś/-aś hasło:</strong><br/>
    Skontaktuj się z nami niezwłocznie, odpowiadając na tego maila.
  </div>

  <p style="font-size: 14px; color: #555;">Jeśli to Ty zainicjowałeś/-aś zmianę, możesz zignorować tę wiadomość. Twoje konto jest bezpieczne.</p>

  <p style="${FOOTER_STYLE}">
    Ten email wysłano na {{email}} w związku ze zmianą hasła w {{brandName}}.
  </p>
</div>`,
    htmlEn: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Password changed</h1>

  <p style="font-size: 16px;">Your password for your <strong>{{brandName}}</strong> account has just been updated.</p>

  <div style="${INFO_BOX_STYLE}">
    <strong>If you didn't change your password:</strong><br/>
    Contact us immediately by replying to this email.
  </div>

  <p style="font-size: 14px; color: #555;">If you initiated this change, you can safely ignore this message. Your account is secure.</p>

  <p style="${FOOTER_STYLE}">
    This email was sent to {{email}} in connection with a password change at {{brandName}}.
  </p>
</div>`,
  },

  'account-deleted': {
    subject: 'Konto zostało usunięte',
    subjectEn: 'Your account was deleted',
    html: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Twoje konto zostało usunięte</h1>

  <p style="font-size: 16px;">Zgodnie z Twoją prośbą, Twoje konto i powiązane dane zostały trwale usunięte z platformy <strong>{{brandName}}</strong>.</p>

  <div style="${INFO_BOX_STYLE}">
    Co zostało usunięte:<br/>
    ✓ Dane profilu i konto<br/>
    ✓ Historia komentarzy i reakcji<br/>
    ✓ Preferencje email i zgody
  </div>

  <p style="font-size: 14px; color: #555;">Jeśli usunąłeś/-aś konto przez pomyłkę lub masz pytania, odpowiedz na tego maila w ciągu 30 dni.</p>

  <p style="${FOOTER_STYLE}">
    Ten email jest jedynym potwierdzeniem usunięcia konta w {{brandName}}.
  </p>
</div>`,
    htmlEn: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Your account has been deleted</h1>

  <p style="font-size: 16px;">As requested, your account and associated data have been permanently removed from <strong>{{brandName}}</strong>.</p>

  <div style="${INFO_BOX_STYLE}">
    What was deleted:<br/>
    ✓ Profile data and account<br/>
    ✓ Comment and reaction history<br/>
    ✓ Email preferences and consents
  </div>

  <p style="font-size: 14px; color: #555;">If you deleted your account by mistake or have questions, reply to this email within 30 days.</p>

  <p style="${FOOTER_STYLE}">
    This email is the sole confirmation of account deletion at {{brandName}}.
  </p>
</div>`,
  },
  'verify-email': {
    subject: 'Potwierdź swój adres e-mail',
    subjectEn: 'Confirm your email address',
    html: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Potwierdź e-mail</h1>

  <p style="font-size: 16px;">Kliknij przycisk, aby potwierdzić adres {{email}} i aktywować konto w <strong>{{brandName}}</strong>. Link działa przez godzinę.</p>

  <a href="{{actionUrl}}" style="${BUTTON_STYLE}">Potwierdzam e-mail →</a>

  <p style="font-size: 14px; color: #555;">Jeśli to nie Ty zakładałeś/-aś konto, zignoruj tę wiadomość.</p>
</div>`,
    htmlEn: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Confirm your email</h1>

  <p style="font-size: 16px;">Click the button to confirm {{email}} and activate your <strong>{{brandName}}</strong> account. The link is valid for one hour.</p>

  <a href="{{actionUrl}}" style="${BUTTON_STYLE}">Confirm email →</a>

  <p style="font-size: 14px; color: #555;">If you did not create an account, you can ignore this message.</p>
</div>`,
  },

  'reset-password': {
    subject: 'Ustaw nowe hasło',
    subjectEn: 'Reset your password',
    html: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Reset hasła</h1>

  <p style="font-size: 16px;">Otrzymaliśmy prośbę o ustawienie nowego hasła do konta <strong>{{brandName}}</strong> ({{email}}). Link działa przez godzinę.</p>

  <a href="{{actionUrl}}" style="${BUTTON_STYLE}">Ustaw nowe hasło →</a>

  <p style="font-size: 14px; color: #555;">Jeśli to nie Ty prosiłeś/-aś o reset, zignoruj tę wiadomość — Twoje hasło się nie zmieni.</p>
</div>`,
    htmlEn: `<div style="${BASE_STYLE}">
  <h1 style="${HEADER_STYLE}">Reset your password</h1>

  <p style="font-size: 16px;">We received a request to set a new password for your <strong>{{brandName}}</strong> account ({{email}}). The link is valid for one hour.</p>

  <a href="{{actionUrl}}" style="${BUTTON_STYLE}">Set a new password →</a>

  <p style="font-size: 14px; color: #555;">If you did not request this, ignore this message — your password will not change.</p>
</div>`,
  },

};
