import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emailsSend } = vi.hoisted(() => ({ emailsSend: vi.fn() }));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: emailsSend } };
  }),
}));

import { sendEmail } from '@/lib/modules/email/infrastructure/email.transport';

const base = { to: 'a@example.com', subject: 's', html: '<p>x</p>', language: 'pl' as const, kind: 'test' };

describe('every automatic mail goes through one transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test_key';
    delete process.env.EMAIL_REPLY_TO;
    emailsSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  });

  it('replies go to support@ by default, and EMAIL_REPLY_TO overrides it', async () => {
    await sendEmail(base);
    expect(emailsSend.mock.calls[0][0]).toMatchObject({ replyTo: 'support@pawelperfect.com' });
    process.env.EMAIL_REPLY_TO = ' team@pawelperfect.com ';
    await sendEmail(base);
    expect(emailsSend.mock.calls[1][0]).toMatchObject({ replyTo: 'team@pawelperfect.com' });
  });

  it('tags the mail as ours (the webhook ignores everything else) and adds a plain-text part', async () => {
    await sendEmail({ ...base, kind: 'verify-email' });
    const sent = emailsSend.mock.calls[0][0];
    expect(sent.tags).toEqual([{ name: 'app', value: 'pawelperfect' }, { name: 'kind', value: 'verify-email' }]);
    expect(sent.text).toContain('x');
    expect(sent.html).toMatch(/^<!DOCTYPE html>/);
  });

  it('adds RFC 8058 one-click headers only to mail that can be unsubscribed from', async () => {
    await sendEmail(base);
    expect(emailsSend.mock.calls[0][0].headers).not.toHaveProperty('List-Unsubscribe');
    await sendEmail({ ...base, unsubscribe: { oneClickUrl: 'https://www.pawelperfect.com/api/subscriptions/unsubscribe?token=t' } });
    expect(emailsSend.mock.calls[1][0].headers).toMatchObject({
      'List-Unsubscribe': '<https://www.pawelperfect.com/api/subscriptions/unsubscribe?token=t>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'Auto-Submitted': 'auto-generated',
    });
  });

  it('passes the idempotency key to Resend and strips line breaks from the subject', async () => {
    await sendEmail({ ...base, subject: 'Hello\r\nBcc: x@example.com', idempotencyKey: 'broadcast/b/r' });
    expect(emailsSend.mock.calls[0][0].subject).toBe('Hello Bcc: x@example.com');
    expect(emailsSend.mock.calls[0][1]).toEqual({ idempotencyKey: 'broadcast/b/r' });
  });

  it('reports a provider error instead of throwing', async () => {
    emailsSend.mockResolvedValueOnce({ data: null, error: { name: 'rate_limit_exceeded', message: 'Too many', statusCode: 429 } });
    await expect(sendEmail(base)).resolves.toEqual({ ok: false, error: { name: 'rate_limit_exceeded', message: 'Too many', statusCode: 429 } });
    emailsSend.mockRejectedValueOnce(new Error('socket hang up'));
    const network = await sendEmail(base);
    expect(network.ok).toBe(false);
  });
});
