import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emailsSend } = vi.hoisted(() => ({ emailsSend: vi.fn() }));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: emailsSend } };
  }),
}));
vi.mock('@/lib/feature-flags', () => ({ flags: { mainCreatorSlug: 'polutek' } }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { LegacyEmailServiceProvider } from '@/lib/modules/email/infrastructure/legacy-email-service-provider';

describe('automatic mail carries Reply-To to the support mailbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test_key';
    delete process.env.EMAIL_REPLY_TO;
    emailsSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  });

  it('transactional mail replies go to hello@ by default', async () => {
    await new LegacyEmailServiceProvider().sendTransactionalEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>' });
    expect(emailsSend).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'hello@pawelperfect.com' }));
  });

  it('test mail replies go to hello@ by default', async () => {
    await new LegacyEmailServiceProvider().sendTestEmail({ to: 'a@example.com', subject: 's', body: '<p>x</p>' });
    expect(emailsSend).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'hello@pawelperfect.com' }));
  });

  it('EMAIL_REPLY_TO overrides the default', async () => {
    process.env.EMAIL_REPLY_TO = ' team@pawelperfect.pl ';
    await new LegacyEmailServiceProvider().sendTransactionalEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>' });
    expect(emailsSend).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'team@pawelperfect.pl' }));
  });
});
