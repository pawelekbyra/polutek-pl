import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emailsSend } = vi.hoisted(() => ({ emailsSend: vi.fn() }));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: emailsSend } };
  }),
}));
vi.mock('@/lib/feature-flags', () => ({ flags: { mainCreatorSlug: 'polutek' } }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import {
  buildFeedbackId,
  getNewsEmailFrom,
  sendEmail,
} from '@/lib/modules/email/infrastructure/resend-email.transport';

const base = { to: 'a@example.com', subject: 's', html: '<p>x</p>', language: 'pl' as const, kind: 'test' };

describe('mass mail uses its own sender on the news subdomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test_key';
    process.env.EMAIL_FROM = 'no-reply@pawelperfect.com';
    delete process.env.EMAIL_FROM_NEWS;
    emailsSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  });

  it('falls back to the transactional sender until EMAIL_FROM_NEWS is set', () => {
    expect(getNewsEmailFrom()).toBe('Pawel Perfect <no-reply@pawelperfect.com>');
  });

  it('adds the brand name to a bare EMAIL_FROM_NEWS address and keeps a full one', () => {
    process.env.EMAIL_FROM_NEWS = 'newsletter@news.pawelperfect.com';
    expect(getNewsEmailFrom()).toBe('Pawel Perfect <newsletter@news.pawelperfect.com>');
    process.env.EMAIL_FROM_NEWS = 'Someone <x@news.pawelperfect.com>';
    expect(getNewsEmailFrom()).toBe('Someone <x@news.pawelperfect.com>');
  });

  it('sends only news-stream mail from the news sender; transactional mail keeps EMAIL_FROM', async () => {
    process.env.EMAIL_FROM_NEWS = 'newsletter@news.pawelperfect.com';
    await sendEmail({ ...base, stream: 'news' });
    await sendEmail(base);
    expect(emailsSend.mock.calls[0][0].from).toBe('Pawel Perfect <newsletter@news.pawelperfect.com>');
    expect(emailsSend.mock.calls[1][0].from).toBe('Pawel Perfect <no-reply@pawelperfect.com>');
  });

  it('every mail carries a Feedback-ID with the stream and ends in the sender id', async () => {
    await sendEmail({ ...base, kind: 'broadcast', stream: 'news' });
    await sendEmail(base);
    expect(emailsSend.mock.calls[0][0].headers['Feedback-ID']).toBe('broadcast:news:pp:ppmail');
    expect(emailsSend.mock.calls[1][0].headers['Feedback-ID']).toBe('test:tx:pp:ppmail');
  });

  it('keeps colons out of the Feedback-ID fields', () => {
    expect(buildFeedbackId('a:b c', 'news')).toBe('a-b-c:news:pp:ppmail');
  });
});
