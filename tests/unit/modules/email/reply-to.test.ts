import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emailsSend } = vi.hoisted(() => ({ emailsSend: vi.fn() }));

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({ sendMail: emailsSend, close: vi.fn() })) } }));

import { sendEmail } from '@/lib/modules/email/infrastructure/email.transport';

const base = { to: 'a@example.com', subject: 's', html: '<p>x</p>', language: 'pl' as const, kind: 'test' };

describe('every automatic mail goes through one transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SES_SMTP_USER = 'test_user';
    process.env.SES_SMTP_PASS = 'test_pass_1234';
    delete process.env.EMAIL_REPLY_TO;
    emailsSend.mockResolvedValue({ response: '250 Ok email_1', messageId: '<local@x>' });
  });

  it('replies go to support@ by default, and EMAIL_REPLY_TO overrides it', async () => {
    await sendEmail(base);
    expect(emailsSend.mock.calls[0][0]).toMatchObject({ replyTo: 'support@pawelperfect.com' });
    process.env.EMAIL_REPLY_TO = ' team@pawelperfect.com ';
    await sendEmail(base);
    expect(emailsSend.mock.calls[1][0]).toMatchObject({ replyTo: 'team@pawelperfect.com' });
  });

  it('tags the mail through X-SES-MESSAGE-TAGS (only with a configuration set) and adds a plain-text part', async () => {
    process.env.SES_CONFIGURATION_SET = 'pp-default';
    await sendEmail({ ...base, kind: 'verify-email' });
    delete process.env.SES_CONFIGURATION_SET;
    const sent = emailsSend.mock.calls[0][0];
    expect(sent.headers['X-SES-MESSAGE-TAGS']).toBe('app=pawelperfect, kind=verify-email');
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

  it('strips line breaks from the subject', async () => {
    await sendEmail({ ...base, subject: 'Hello\r\nBcc: x@example.com' });
    expect(emailsSend.mock.calls[0][0].subject).toBe('Hello Bcc: x@example.com');
  });

  it('reports a provider error instead of throwing', async () => {
    emailsSend.mockRejectedValueOnce(Object.assign(new Error('Throttling'), { responseCode: 454, response: '454 Throttling failure: Maximum sending rate exceeded' }));
    const throttled = await sendEmail(base);
    expect(throttled).toMatchObject({ ok: false, error: { name: 'rate_limit_exceeded', statusCode: 429 } });
    emailsSend.mockRejectedValueOnce(new Error('socket hang up'));
    expect((await sendEmail(base)).ok).toBe(false);
  });
});
