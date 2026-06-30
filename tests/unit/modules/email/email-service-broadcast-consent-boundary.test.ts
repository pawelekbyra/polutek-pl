import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emailsSend, contactsCreate, broadcastFindUnique, broadcastUpdate, recipientUpdate, recipientGroupBy, preferenceFindMany, subscriptionFindMany, creatorFindUnique, subscriptionCreate } = vi.hoisted(() => ({
  emailsSend: vi.fn(),
  contactsCreate: vi.fn(),
  broadcastFindUnique: vi.fn(),
  broadcastUpdate: vi.fn(),
  recipientUpdate: vi.fn(),
  recipientGroupBy: vi.fn(),
  preferenceFindMany: vi.fn(),
  subscriptionFindMany: vi.fn(),
  creatorFindUnique: vi.fn(),
  subscriptionCreate: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function() { return {
    emails: { send: emailsSend },
    contacts: { create: contactsCreate },
  }; }),
}));

vi.mock('@/lib/feature-flags', () => ({
  flags: { mainCreatorSlug: 'polutek' },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    broadcastEmail: { findUnique: broadcastFindUnique, update: broadcastUpdate },
    broadcastEmailRecipient: { update: recipientUpdate, groupBy: recipientGroupBy },
    emailPreference: { findMany: preferenceFindMany },
    subscription: { findMany: subscriptionFindMany, create: subscriptionCreate },
    creator: { findUnique: creatorFindUnique },
  },
}));

describe('EmailService broadcast content consent boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test_key';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET = 'a'.repeat(32);
    emailsSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });
    broadcastUpdate.mockResolvedValue({});
    recipientUpdate.mockResolvedValue({});
    recipientGroupBy.mockResolvedValue([{ status: 'SENT', _count: 1 }]);
    creatorFindUnique.mockResolvedValue({ id: 'creator_1' });
    preferenceFindMany.mockResolvedValue([{ email: 'sub@example.com', marketingEmails: true }]);
    subscriptionFindMany.mockResolvedValue([{ userId: 'u1' }]);
  });

  async function sendBroadcastWithRecipients(recipients: any[]) {
    broadcastFindUnique.mockResolvedValue({
      id: 'b1',
      subjectPl: 'Temat',
      subjectEn: 'Subject',
      htmlPl: '<p>{{email}}</p>',
      htmlEn: '<p>{{email}}</p>',
      recipients,
    });
    const { LegacyEmailServiceProvider } = await import('@/lib/modules/email/infrastructure/legacy-email-service-provider');
    const provider = new LegacyEmailServiceProvider();
    await provider.sendBroadcast({
      broadcastId: 'b1',
      subject: '',
      body: '',
      recipients: [],
    });
  }

  it('sends content broadcast only with active Subscription and explicit preference opt-in', async () => {
    await sendBroadcastWithRecipients([{ id: 'r1', userId: 'u1', email: 'sub@example.com', language: 'pl' }]);

    expect(emailsSend).toHaveBeenCalledTimes(1);
    expect(contactsCreate).not.toHaveBeenCalled();
    expect(subscriptionCreate).not.toHaveBeenCalled();
  });

  it('skips when Subscription is missing even if EmailPreference is true', async () => {
    preferenceFindMany.mockResolvedValue([{ email: 'legacy@example.com', marketingEmails: true }]);
    subscriptionFindMany.mockResolvedValue([]);

    await sendBroadcastWithRecipients([{ id: 'r1', userId: 'u1', email: 'legacy@example.com', language: 'pl' }]);

    expect(emailsSend).not.toHaveBeenCalled();
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'r1' },
      data: { status: 'SKIPPED', error: 'NO_VERIFIABLE_CONTENT_OPT_IN' },
    }));
  });

  it('skips when userId is missing', async () => {
    await sendBroadcastWithRecipients([{ id: 'r1', userId: null, email: 'nouser@example.com', language: 'pl' }]);

    expect(emailsSend).not.toHaveBeenCalled();
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'SKIPPED', error: 'NO_VERIFIABLE_CONTENT_OPT_IN' },
    }));
  });

  it('skips when legacy marketingEmails is false', async () => {
    preferenceFindMany.mockResolvedValue([{ email: 'out@example.com', marketingEmails: false }]);

    await sendBroadcastWithRecipients([{ id: 'r1', userId: 'u1', email: 'out@example.com', language: 'pl' }]);

    expect(emailsSend).not.toHaveBeenCalled();
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'SKIPPED', error: 'CONTENT_NOTIFICATIONS_OPTED_OUT' },
    }));
  });
});
