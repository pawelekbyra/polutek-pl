import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMail, createTransport, close } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  close: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock('nodemailer', () => {
  createTransport.mockImplementation(() => ({ sendMail, close }));
  return { default: { createTransport } };
});

import { sendEmail } from '@/lib/modules/email/infrastructure/email.transport';
import { mapSesError, resetSesTransportForTests } from '@/lib/modules/email/infrastructure/ses-email.transport';
import { classifySendFailure } from '@/lib/modules/email/domain/broadcast-queue.policy';
import { logger } from '@/lib/logger';

const base = { to: 'a@example.com', subject: 's', html: '<p>x</p>', language: 'pl' as const, kind: 'verify-email' };
const SECRET = 'SuperSecretSesPassword987';

describe('SES transport (the only transport, nodemailer mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTransport.mockImplementation(() => ({ sendMail, close }));
    resetSesTransportForTests();
    process.env.SES_SMTP_USER = 'AKIAEXAMPLEUSER';
    process.env.SES_SMTP_PASS = SECRET;
    delete process.env.AWS_REGION;
    delete process.env.SES_SMTP_HOST;
    delete process.env.SES_CONFIGURATION_SET;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_REPLY_TO;
    delete process.env.EMAIL_SUPPORT_FROM;
    sendMail.mockResolvedValue({ response: '250 Ok 0100019abc-1111-2222-000000', messageId: '<local@x>' });
  });
  afterEach(() => {
    delete process.env.SES_SMTP_USER;
    delete process.env.SES_SMTP_PASS;
  });

  it('opens a pooled STARTTLS connection on 587 to the Stockholm endpoint', async () => {
    const result = await sendEmail(base);
    expect(result).toEqual({ ok: true, id: '0100019abc-1111-2222-000000' });
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport.mock.calls[0][0]).toMatchObject({
      host: 'email-smtp.eu-north-1.amazonaws.com',
      port: 587,
      secure: false,
      requireTLS: true,
      pool: true,
      auth: { user: 'AKIAEXAMPLEUSER', pass: SECRET },
    });
    expect(createTransport.mock.calls[0][0].connectionTimeout).toBeGreaterThan(0);
    await sendEmail(base);
    expect(createTransport).toHaveBeenCalledTimes(1); // transporter is reused
  });

  it('uses AWS_REGION for the endpoint', async () => {
    process.env.AWS_REGION = 'eu-west-1';
    await sendEmail(base);
    expect(createTransport.mock.calls[0][0].host).toBe('email-smtp.eu-west-1.amazonaws.com');
    delete process.env.AWS_REGION;
  });

  it('system mail: From no-reply@, Reply-To support@, no List-Unsubscribe', async () => {
    await sendEmail(base);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.from).toBe('Pawel Perfect <no-reply@pawelperfect.com>');
    expect(mail.replyTo).toBe('support@pawelperfect.com');
    expect(mail.to).toBe('a@example.com');
    expect(mail.headers).toMatchObject({ 'Auto-Submitted': 'auto-generated' });
    expect(mail.headers).not.toHaveProperty('List-Unsubscribe');
    expect(mail.headers).not.toHaveProperty('List-Unsubscribe-Post');
    expect(mail.text).toContain('x');
    expect(mail.html).toMatch(/^<!DOCTYPE html>/);
  });

  it('EMAIL_FROM and EMAIL_REPLY_TO override; sender "support" uses EMAIL_SUPPORT_FROM', async () => {
    process.env.EMAIL_FROM = 'hello@pawelperfect.com';
    process.env.EMAIL_REPLY_TO = 'team@pawelperfect.com';
    await sendEmail(base);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ from: 'Pawel Perfect <hello@pawelperfect.com>', replyTo: 'team@pawelperfect.com' });
    await sendEmail({ ...base, sender: 'support' });
    expect(sendMail.mock.calls[1][0].from).toBe('Pawel Perfect <support@pawelperfect.com>');
    process.env.EMAIL_SUPPORT_FROM = 'Pawel z supportu <help@pawelperfect.com>';
    await sendEmail({ ...base, sender: 'support' });
    expect(sendMail.mock.calls[2][0].from).toBe('Pawel z supportu <help@pawelperfect.com>');
  });

  it('marketing mail carries RFC 8058 one-click headers', async () => {
    await sendEmail({ ...base, kind: 'broadcast', unsubscribe: { oneClickUrl: 'https://www.pawelperfect.com/api/subscriptions/unsubscribe?token=t' } });
    expect(sendMail.mock.calls[0][0].headers).toMatchObject({
      'List-Unsubscribe': '<https://www.pawelperfect.com/api/subscriptions/unsubscribe?token=t>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('adds the configuration set and tags only when SES_CONFIGURATION_SET is set', async () => {
    await sendEmail(base);
    expect(sendMail.mock.calls[0][0].headers).not.toHaveProperty('X-SES-CONFIGURATION-SET');
    process.env.SES_CONFIGURATION_SET = 'pp-default';
    await sendEmail(base);
    expect(sendMail.mock.calls[1][0].headers).toMatchObject({
      'X-SES-CONFIGURATION-SET': 'pp-default',
      'X-SES-MESSAGE-TAGS': 'app=pawelperfect, kind=verify-email',
    });
  });

  it('strips line breaks from the subject (header injection)', async () => {
    await sendEmail({ ...base, subject: 'Hello\r\nBcc: x@example.com' });
    expect(sendMail.mock.calls[0][0].subject).toBe('Hello Bcc: x@example.com');
  });

  it('refuses to send without credentials and does not open a connection', async () => {
    delete process.env.SES_SMTP_PASS;
    const result = await sendEmail(base);
    expect(result).toMatchObject({ ok: false, error: { name: 'smtp_credentials_missing' } });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('maps SES rejections to errors the app understands, without throwing', async () => {
    sendMail.mockRejectedValueOnce(Object.assign(new Error('Message rejected'), { responseCode: 554, response: '554 Message rejected: Email address is not verified. The following identities failed the check in region EU-NORTH-1: b@example.com' }));
    const unverified = await sendEmail(base);
    expect(unverified).toMatchObject({ ok: false, error: { name: 'message_rejected_not_verified', statusCode: 554 } });
    expect((unverified as { error: { hint?: string } }).error.hint).toMatch(/sandbox/);

    sendMail.mockRejectedValueOnce(Object.assign(new Error('Daily message quota exceeded'), { responseCode: 454, response: '454 Throttling failure: Daily message quota exceeded' }));
    expect(await sendEmail(base)).toMatchObject({ ok: false, error: { name: 'daily_quota_exceeded', statusCode: 429 } });

    sendMail.mockRejectedValueOnce(Object.assign(new Error('Maximum sending rate exceeded'), { responseCode: 454, response: '454 Throttling failure: Maximum sending rate exceeded.' }));
    expect(await sendEmail(base)).toMatchObject({ ok: false, error: { name: 'rate_limit_exceeded', statusCode: 429 } });

    sendMail.mockRejectedValueOnce(Object.assign(new Error('socket'), { code: 'ECONNECTION' }));
    expect(await sendEmail(base)).toMatchObject({ ok: false, error: { name: 'smtp_connection_failed', statusCode: null } });
  });

  it('feeds the broadcast queue policy: throttling pauses, auth pauses, rejection fails the recipient, network retries', () => {
    expect(classifySendFailure(mapSesError(Object.assign(new Error('x'), { responseCode: 454, response: '454 Throttling failure: Maximum sending rate exceeded' })), 1).kind).toBe('pause');
    expect(classifySendFailure(mapSesError(Object.assign(new Error('x'), { responseCode: 454, response: '454 Throttling failure: Daily message quota exceeded' })), 1)).toMatchObject({ kind: 'pause', delayMs: 3_600_000 });
    expect(classifySendFailure(mapSesError(Object.assign(new Error('x'), { code: 'EAUTH', responseCode: 535 })), 1).kind).toBe('pause');
    expect(classifySendFailure(mapSesError(Object.assign(new Error('x'), { responseCode: 554, response: '554 Message rejected: Email address is not verified.' })), 1).kind).toBe('fail');
    expect(classifySendFailure(mapSesError(Object.assign(new Error('x'), { code: 'ETIMEDOUT' })), 1).kind).toBe('retry');
  });

  it('never leaks the SMTP password into logs, errors or hints', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    sendMail.mockRejectedValueOnce(Object.assign(new Error(`Invalid login for AKIAEXAMPLEUSER with ${SECRET}`), { code: 'EAUTH', responseCode: 535, response: `535 Authentication Credentials Invalid ${SECRET}` }));
    const result = await sendEmail(base);
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(JSON.stringify(result)).not.toContain('AKIAEXAMPLEUSER');
    expect(JSON.stringify([...warn.mock.calls, ...error.mock.calls])).not.toContain(SECRET);
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('Resend is gone', () => {
  it('no Resend package, no provider switch in the code', async () => {
    const fs = await import('node:fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty('resend');
    const config = fs.readFileSync('lib/email-config.ts', 'utf8');
    expect(config).not.toMatch(/EMAIL_PROVIDER|RESEND/);
  });
});
