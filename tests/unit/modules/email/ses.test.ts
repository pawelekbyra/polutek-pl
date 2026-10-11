import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emailsSend } = vi.hoisted(() => ({ emailsSend: vi.fn() }));
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: emailsSend } };
  }),
}));
vi.mock('@/lib/feature-flags', () => ({ flags: { mainCreatorSlug: 'polutek' } }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail, close: vi.fn() })) },
}));

import { getEmailProvider, sendEmail } from '@/lib/modules/email/infrastructure/resend-email.transport';
import {
  buildSesHeaders,
  extractSesMessageId,
  getSesConfig,
  isSesUnavailable,
  mapSesError,
  resetSesTransportForTests,
  sendViaSes,
  SES_DEFAULT_HOST,
  type SesMessage,
} from '@/lib/modules/email/infrastructure/ses-email.transport';

const message: SesMessage = {
  from: 'Pawel Perfect <no-reply@pawelperfect.com>',
  to: 'a@example.com',
  subject: 'Temat',
  html: '<p>x</p>',
  text: 'x',
  replyTo: 'support@pawelperfect.com',
  headers: { 'Auto-Submitted': 'auto-generated', 'Feedback-ID': 'welcome:tx:pp:ppmail', 'List-Unsubscribe': '<https://x/u>' },
  kind: 'welcome-email',
};
const env = { SES_SMTP_USER: 'AKIAEXAMPLE', SES_SMTP_PASS: 'secret' };

describe('SES configuration', () => {
  it('needs both SMTP credentials; defaults to the Stockholm endpoint on 587', () => {
    expect(getSesConfig({})).toBeNull();
    expect(getSesConfig({ SES_SMTP_USER: 'u' })).toBeNull();
    expect(getSesConfig(env)).toEqual({ host: SES_DEFAULT_HOST, port: 587, user: 'AKIAEXAMPLE', pass: 'secret', configurationSet: null });
    expect(SES_DEFAULT_HOST).toBe('email-smtp.eu-north-1.amazonaws.com');
    expect(getSesConfig({ ...env, SES_SMTP_HOST: 'email-smtp.eu-west-1.amazonaws.com', SES_SMTP_PORT: '465', SES_CONFIGURATION_SET: 'pp' })).toMatchObject({
      host: 'email-smtp.eu-west-1.amazonaws.com', port: 465, configurationSet: 'pp',
    });
  });
});

describe('SES message', () => {
  it('keeps our headers and adds message tags (app, kind, stream) and the configuration set', () => {
    const h = buildSesHeaders(message, { configurationSet: 'pp' });
    expect(h['List-Unsubscribe']).toBe('<https://x/u>');
    expect(h['Feedback-ID']).toBe('welcome:tx:pp:ppmail');
    expect(h['X-SES-MESSAGE-TAGS']).toBe('app=pawelperfect, kind=welcome-email, stream=tx');
    expect(h['X-SES-CONFIGURATION-SET']).toBe('pp');
    expect(buildSesHeaders({ ...message, kind: 'new video!', stream: 'news' }, { configurationSet: null })['X-SES-MESSAGE-TAGS']).toBe('app=pawelperfect, kind=new-video-, stream=news');
    expect(buildSesHeaders(message, { configurationSet: null })).not.toHaveProperty('X-SES-CONFIGURATION-SET');
  });

  it('reads the SES message id from the 250 reply', () => {
    expect(extractSesMessageId('250 Ok 010201a2b3c4d5e6-0f1e2d3c-1111-2222-3333-444455556666-000000')).toBe('010201a2b3c4d5e6-0f1e2d3c-1111-2222-3333-444455556666-000000');
    expect(extractSesMessageId('250 queued')).toBeNull();
    expect(extractSesMessageId(undefined)).toBeNull();
  });
});

describe('sendViaSes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSesTransportForTests();
  });

  it('hands the message to SMTP and returns the SES id', async () => {
    sendMail.mockResolvedValue({ response: '250 Ok 0102abc-def-000000', messageId: '<x@y>' });
    const r = await sendViaSes(message, getSesConfig(env));
    expect(r).toEqual({ ok: true, id: '0102abc-def-000000' });
    const sent = sendMail.mock.calls[0][0];
    expect(sent).toMatchObject({ from: message.from, to: 'a@example.com', replyTo: 'support@pawelperfect.com', subject: 'Temat' });
    expect(sent.headers['X-SES-MESSAGE-TAGS']).toContain('kind=welcome-email');
  });

  it('is not configured without credentials', async () => {
    const r = await sendViaSes(message, null);
    expect(r).toMatchObject({ ok: false, error: { name: 'SesNotConfigured' } });
  });

  it('maps SMTP and connection errors, and tells provider trouble from recipient trouble', () => {
    expect(mapSesError({ responseCode: 554, message: 'Message rejected: Email address is not verified.' })).toEqual({
      name: 'ses_smtp_554', message: 'Message rejected: Email address is not verified.', statusCode: 554,
    });
    expect(mapSesError({ code: 'ETIMEDOUT', message: 'timeout' })).toEqual({ name: 'ses_etimedout', message: 'timeout', statusCode: null });
    // provider trouble: fall back
    expect(isSesUnavailable({ name: 'x', message: 'Connection timeout', statusCode: null })).toBe(true);
    expect(isSesUnavailable({ name: 'x', message: 'Throttling failure: Maximum sending rate exceeded.', statusCode: 454 })).toBe(true);
    expect(isSesUnavailable({ name: 'x', message: 'Authentication Credentials Invalid', statusCode: 535 })).toBe(true);
    expect(isSesUnavailable({ name: 'x', message: 'Message rejected: Email address is not verified.', statusCode: 554 })).toBe(true);
    expect(isSesUnavailable({ name: 'x', message: 'Daily message quota exceeded', statusCode: 554 })).toBe(true);
    // recipient trouble: final
    expect(isSesUnavailable({ name: 'x', message: 'Invalid address syntax', statusCode: 501 })).toBe(false);
    expect(isSesUnavailable({ name: 'x', message: 'Mailbox name not allowed', statusCode: 553 })).toBe(false);
  });
});

describe('sendEmail with EMAIL_PROVIDER=ses', () => {
  const base = { to: 'a@example.com', subject: 's', html: '<p>x</p>', language: 'pl' as const, kind: 'welcome-email' };
  beforeEach(() => {
    vi.clearAllMocks();
    resetSesTransportForTests();
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'Pawel Perfect <no-reply@pawelperfect.com>';
    process.env.EMAIL_PROVIDER = 'ses';
    process.env.SES_SMTP_USER = 'AKIAEXAMPLE';
    process.env.SES_SMTP_PASS = 'secret';
    delete process.env.EMAIL_FROM_NEWS;
    delete process.env.EMAIL_OWN_SMTP_HOST;
    emailsSend.mockResolvedValue({ data: { id: 'rs_1' }, error: null });
  });

  it('picks SES only when the credentials exist', () => {
    expect(getEmailProvider({ EMAIL_PROVIDER: 'ses' })).toBe('resend');
    expect(getEmailProvider({ EMAIL_PROVIDER: 'ses', ...env })).toBe('ses');
    expect(getEmailProvider({ EMAIL_PROVIDER: 'SES', ...env })).toBe('ses');
    expect(getEmailProvider({ ...env })).toBe('resend');
  });

  it('sends through SES and does not touch Resend on success', async () => {
    sendMail.mockResolvedValue({ response: '250 Ok 0102abc-000000' });
    const r = await sendEmail(base);
    expect(r).toEqual({ ok: true, id: '0102abc-000000' });
    expect(emailsSend).not.toHaveBeenCalled();
    expect(sendMail.mock.calls[0][0].from).toBe('Pawel Perfect <no-reply@pawelperfect.com>');
  });

  it('falls back to Resend when SES cannot send (sandbox, throttling, outage)', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('Message rejected: Email address is not verified.'), { responseCode: 554 }));
    const r = await sendEmail(base);
    expect(r).toEqual({ ok: true, id: 'rs_1' });
    expect(emailsSend).toHaveBeenCalledTimes(1);
  });

  it('does not fall back for a recipient error: the address is the problem, not the provider', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('Invalid address syntax'), { responseCode: 501 }));
    const r = await sendEmail(base);
    expect(r.ok).toBe(false);
    expect(emailsSend).not.toHaveBeenCalled();
  });
});
