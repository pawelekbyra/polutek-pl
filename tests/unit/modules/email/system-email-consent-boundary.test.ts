import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const { emailsSend, contactsCreate, contactsUpdate, contactsGet, emailTemplateFindUnique, emailPreferenceUpsert, subscriptionCreate, userFindUnique } = vi.hoisted(() => ({
  emailsSend: vi.fn(),
  contactsCreate: vi.fn(),
  contactsUpdate: vi.fn(),
  contactsGet: vi.fn(),
  emailTemplateFindUnique: vi.fn(),
  emailPreferenceUpsert: vi.fn(),
  subscriptionCreate: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function() { return {
    emails: { send: emailsSend },
    contacts: {
      create: contactsCreate,
      update: contactsUpdate,
      get: contactsGet,
    },
  }; }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    emailTemplate: { findUnique: emailTemplateFindUnique },
    emailPreference: { upsert: emailPreferenceUpsert },
    subscription: { create: subscriptionCreate },
  },
}));

describe('system email consent boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      RESEND_API_KEY: 'test_key',
      RESEND_AUDIENCE_ID: 'audience_123',
      NEXT_PUBLIC_APP_URL: 'https://polutek.example',
      EMAIL_UNSUBSCRIBE_SIGNING_SECRET: 'a'.repeat(32),
    };
    emailsSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });
    emailTemplateFindUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValue({ id: 'user_opaque_1' });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('sendWelcomeEmail sends email without Resend Contacts or local consent mutation', async () => {
    const { sendWelcomeEmail } = await import('@/lib/modules/email');

    await sendWelcomeEmail('user@example.com', 'User');

    expect(emailsSend).toHaveBeenCalledTimes(1);
    expect(contactsCreate).not.toHaveBeenCalled();
    expect(contactsUpdate).not.toHaveBeenCalled();
    expect(contactsGet).not.toHaveBeenCalled();
    expect(emailPreferenceUpsert).not.toHaveBeenCalled();
    expect(subscriptionCreate).not.toHaveBeenCalled();
  });

  it('tip thank-you email sends without Resend Contacts', async () => {
    const { sendDonationThankYouEmail } = await import('@/lib/modules/email');

    await sendDonationThankYouEmail('tipper@example.com', 10, 'PLN');

    expect(emailsSend).toHaveBeenCalledTimes(1);
    expect(contactsCreate).not.toHaveBeenCalled();
    expect(contactsUpdate).not.toHaveBeenCalled();
    expect(contactsGet).not.toHaveBeenCalled();
  });

  it('patron notification email sends without Resend Contacts', async () => {
    const { sendBecomePatronEmail } = await import('@/lib/modules/email');

    await sendBecomePatronEmail('patron@example.com', 10, 'PLN');

    expect(emailsSend).toHaveBeenCalledTimes(1);
    expect(contactsCreate).not.toHaveBeenCalled();
    expect(contactsUpdate).not.toHaveBeenCalled();
    expect(contactsGet).not.toHaveBeenCalled();
  });

  it('patron notification email includes a signed List-Unsubscribe header without exposing the recipient email', async () => {
    const { sendBecomePatronEmail } = await import('@/lib/modules/email');

    await sendBecomePatronEmail('patron@example.com', 10, 'PLN');

    const sendInput = emailsSend.mock.calls[0][0];
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { email: 'patron@example.com' },
      select: { id: true },
    });
    expect(sendInput.headers).toEqual(expect.objectContaining({
      'List-Unsubscribe': expect.stringMatching(/^<https:\/\/polutek\.example\/unsubscribe\?token=.+>$/),
    }));
    expect(sendInput.headers['List-Unsubscribe']).not.toContain('patron@example.com');
    expect(sendInput.headers).not.toHaveProperty('List-Unsubscribe-Post');
  });

  it('account deleted email sends without Resend Contacts', async () => {
    const { sendAccountDeletedEmail } = await import('@/lib/modules/email');

    await sendAccountDeletedEmail('deleted@example.com');

    expect(emailsSend).toHaveBeenCalledTimes(1);
    expect(contactsCreate).not.toHaveBeenCalled();
    expect(contactsUpdate).not.toHaveBeenCalled();
    expect(contactsGet).not.toHaveBeenCalled();
  });

  it('security email sends without Resend Contacts', async () => {
    const { sendPasswordChangedEmail } = await import('@/lib/modules/email');

    await sendPasswordChangedEmail('secure@example.com');

    expect(emailsSend).toHaveBeenCalledTimes(1);
    expect(contactsCreate).not.toHaveBeenCalled();
    expect(contactsUpdate).not.toHaveBeenCalled();
    expect(contactsGet).not.toHaveBeenCalled();
  });
});