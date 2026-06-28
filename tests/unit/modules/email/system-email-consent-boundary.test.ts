import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emailsSend, contactsCreate, contactsUpdate, contactsGet, emailTemplateFindUnique, emailPreferenceUpsert, subscriptionCreate } = vi.hoisted(() => ({
  emailsSend: vi.fn(),
  contactsCreate: vi.fn(),
  contactsUpdate: vi.fn(),
  contactsGet: vi.fn(),
  emailTemplateFindUnique: vi.fn(),
  emailPreferenceUpsert: vi.fn(),
  subscriptionCreate: vi.fn(),
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
    emailTemplate: { findUnique: emailTemplateFindUnique },
    emailPreference: { upsert: emailPreferenceUpsert },
    subscription: { create: subscriptionCreate },
  },
}));

describe('system email consent boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test_key';
    process.env.RESEND_AUDIENCE_ID = 'audience_123';
    emailsSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });
    emailTemplateFindUnique.mockResolvedValue(null);
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
