import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const { emailsSend, contactsCreate, emailTemplateFindUnique, emailPreferenceUpsert, subscriptionCreate, userFindUnique } = vi.hoisted(() => ({
  emailsSend: vi.fn(),
  contactsCreate: vi.fn(),
  emailTemplateFindUnique: vi.fn(),
  emailPreferenceUpsert: vi.fn(),
  subscriptionCreate: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({ sendMail: emailsSend, close: vi.fn() })) } }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    emailTemplate: { findUnique: emailTemplateFindUnique },
    emailPreference: { upsert: emailPreferenceUpsert },
    subscription: { create: subscriptionCreate },
  },
}));

type SentMail = { subject: string; html: string; text: string; headers: Record<string, string> };
const sent = (index = 0) => emailsSend.mock.calls[index][0] as SentMail;

describe('system emails', () => {
  // The email module has a large import graph; warm it up once.
  beforeAll(async () => {
    await import('@/lib/modules/email');
  }, 60_000);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      SES_SMTP_USER: 'test_user',
      SES_SMTP_PASS: 'test_pass_1234',
      NEXT_PUBLIC_APP_URL: 'https://www.pawelperfect.com',
      EMAIL_UNSUBSCRIBE_SIGNING_SECRET: 'a'.repeat(32),
    };
    emailsSend.mockResolvedValue({ response: '250 Ok email_1', messageId: '<local@x>' });
    emailTemplateFindUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValue({ id: 'user_1', name: 'Mr Bean', username: null, isDeleted: false });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('sends the code default when no admin saved the template, ignoring an old seeded row', async () => {
    const { sendVerificationEmail } = await import('@/lib/modules/email');
    const { EMAIL_DEFAULTS } = await import('@/lib/email-defaults');
    emailTemplateFindUnique.mockResolvedValue({
      slug: 'verify-email',
      subject: 'Potwierdź swój e-mail — {{appName}}',
      html: '<h1 style="text-transform: uppercase">OLD</h1>',
      subjectEn: null,
      htmlEn: null,
      customizedAt: null,
    });

    await sendVerificationEmail('a@example.com', 'https://www.pawelperfect.com/api/auth/verify-email?token=t&callbackURL=%2F', 'pl');

    expect(sent().subject).toBe(EMAIL_DEFAULTS['verify-email'].subject);
    expect(sent().html).not.toContain('OLD');
    expect(sent().html).toContain('href="https://www.pawelperfect.com/api/auth/verify-email?token=t&amp;callbackURL=%2F"');
  });

  it('sends the admin override when the admin saved it', async () => {
    const { sendWelcomeEmail } = await import('@/lib/modules/email');
    emailTemplateFindUnique.mockResolvedValue({
      slug: 'welcome-email',
      subject: 'Siema {{firstName}}',
      html: '<p>Admin text for {{firstName}}</p>',
      subjectEn: null,
      htmlEn: null,
      customizedAt: new Date('2026-10-01T00:00:00Z'),
    });

    await sendWelcomeEmail('a@example.com', 'pl');

    expect(sent().subject).toBe('Siema Mr Bean');
    expect(sent().html).toContain('Admin text for Mr Bean');
  });

  it('escapes values put into the HTML and keeps the subject on one line', async () => {
    const { sendWelcomeEmail } = await import('@/lib/modules/email');
    userFindUnique.mockResolvedValue({ id: 'user_1', name: '<a href="https://evil.example">Klik</a>', username: null, isDeleted: false });
    emailTemplateFindUnique.mockResolvedValue({
      slug: 'welcome-email',
      subject: 'Hi {{firstName}}',
      html: '<p>Hi {{firstName}}</p>',
      subjectEn: null,
      htmlEn: null,
      customizedAt: new Date(),
    });

    await sendWelcomeEmail('a@example.com', 'pl');

    expect(sent().html).not.toContain('<a href="https://evil.example">');
    expect(sent().html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;Klik&lt;/a&gt;');
  });

  it('greets with the whole nickname, not its first word', async () => {
    const { sendBecomePatronEmail } = await import('@/lib/modules/email');
    await sendBecomePatronEmail('a@example.com', 10, 'PLN', 'pl');
    expect(sent().html).toContain('Dziękuję, Mr Bean!');
  });

  it('welcome mail carries the unsubscribe link and RFC 8058 one-click headers, never the address', async () => {
    const { sendWelcomeEmail } = await import('@/lib/modules/email');
    await sendWelcomeEmail('person@example.com', 'en');
    expect(sent().headers['List-Unsubscribe']).toMatch(/^<https:\/\/www\.pawelperfect\.com\/api\/subscriptions\/unsubscribe\?token=.+>$/);
    expect(sent().headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(sent().headers['List-Unsubscribe']).not.toContain('person@example.com');
    expect(sent().html).toMatch(/href="https:\/\/www\.pawelperfect\.com\/unsubscribe\?token=[^"]+"/);
  });

  it('security and payment mails have no marketing unsubscribe link or header', async () => {
    const email = await import('@/lib/modules/email');
    await email.sendVerificationEmail('a@example.com', 'https://x.example/verify', 'pl');
    await email.sendPasswordResetEmail('a@example.com', 'https://x.example/reset', 'en');
    await email.sendPasswordChangedEmail('a@example.com', 'pl');
    await email.sendDonationThankYouEmail('a@example.com', 5, 'EUR', 'en');
    await email.sendBecomePatronEmail('a@example.com', 10, 'PLN', 'pl');

    expect(emailsSend).toHaveBeenCalledTimes(5);
    for (const [input] of emailsSend.mock.calls as Array<[SentMail]>) {
      expect(input.headers).not.toHaveProperty('List-Unsubscribe');
      expect(input.html).not.toContain('/unsubscribe');
    }
  });

  it('fills every placeholder, tags the mail and never links to a missing preferences page', async () => {
    process.env.SES_CONFIGURATION_SET = 'pp-default';
    onTestFinished(() => { delete process.env.SES_CONFIGURATION_SET; });
    const email = await import('@/lib/modules/email');
    await email.sendBecomePatronEmail('patron@example.com', 10, 'PLN', 'pl');
    await email.sendDonationThankYouEmail('tipper@example.com', 5, 'PLN', 'en');
    await email.sendWelcomeEmail('new@example.com', 'pl');

    for (const [input] of emailsSend.mock.calls as Array<[SentMail]>) {
      expect(input.html).not.toMatch(/\{\{\s*\w+\s*\}\}/);
      expect(input.subject).not.toMatch(/\{\{\s*\w+\s*\}\}/);
      expect(input.html).not.toContain('/profile/settings');
      expect(input.headers['X-SES-MESSAGE-TAGS']).toContain('app=pawelperfect');
    }
  });

  it('support mails promise no access in return for a tip', async () => {
    const email = await import('@/lib/modules/email');
    await email.sendBecomePatronEmail('patron@example.com', 10, 'PLN', 'pl');
    await email.sendBecomePatronEmail('patron@example.com', 10, 'PLN', 'en');
    await email.sendWelcomeEmail('new@example.com', 'pl');
    for (const [input] of emailsSend.mock.calls as Array<[SentMail]>) {
      expect(input.html).not.toMatch(/Strefy Patrona|Strefę Patrona|Patron Zone|dostęp do materiałów PATRON|permanent access/);
    }
  });

  it('account-deleted mail goes out in the language the person used, and touches no consent data', async () => {
    const { sendAccountDeletedEmail } = await import('@/lib/modules/email');
    userFindUnique.mockResolvedValue(null); // the row was anonymised before the mail goes out
    await sendAccountDeletedEmail('deleted@example.com', 'en');
    expect(sent().subject).toBe('Your account was deleted');
    expect(sent().html).toContain('lang="en"');
    expect(contactsCreate).not.toHaveBeenCalled();
    expect(emailPreferenceUpsert).not.toHaveBeenCalled();
    expect(subscriptionCreate).not.toHaveBeenCalled();
  });

  it('throws when SES refuses, so callers can log it', async () => {
    const { sendPasswordChangedEmail } = await import('@/lib/modules/email');
    emailsSend.mockRejectedValue(Object.assign(new Error('Message rejected'), { responseCode: 554, response: '554 Message rejected' }));
    await expect(sendPasswordChangedEmail('a@example.com', 'pl')).rejects.toThrow(/password-changed/);
  });
});
