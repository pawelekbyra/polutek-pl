import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { emailsSend, sendMail } = vi.hoisted(() => ({ emailsSend: vi.fn(), sendMail: vi.fn() }));
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: emailsSend } };
  }),
}));
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail, close: vi.fn() })) },
}));
vi.mock('@/lib/feature-flags', () => ({ flags: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { sendEmail } from '@/lib/modules/email/infrastructure/resend-email.transport';
import {
  extractQueueId,
  getOwnMailConfig,
  mapOwnMailError,
  recipientBucket,
  resetOwnMailTransportForTests,
  sendViaOwnMail,
  shouldUseOwnTransport,
  type OwnMailConfig,
} from '@/lib/modules/email/infrastructure/own-mail.transport';

const config: OwnMailConfig = { host: 'pp-mail-lab', port: 25, envelopeFrom: 'lab@lab.pawelperfect.com', kinds: new Set(['welcome']), share: 100 };
const message = {
  from: 'Pawel Perfect <no-reply@pawelperfect.com>',
  to: 'a@example.com',
  subject: 'Temat',
  html: '<p>x</p>',
  text: 'x',
  replyTo: 'support@pawelperfect.com',
  headers: { 'Auto-Submitted': 'auto-generated' },
  kind: 'welcome',
};

describe('own mail config and routing', () => {
  it('is off without a host and parses the rest with safe defaults', () => {
    expect(getOwnMailConfig({})).toBeNull();
    expect(getOwnMailConfig({ EMAIL_OWN_SMTP_HOST: ' mail-lab ' })).toEqual({
      host: 'mail-lab', port: 25, envelopeFrom: 'lab@lab.pawelperfect.com', kinds: new Set(), share: 0,
    });
    const c = getOwnMailConfig({ EMAIL_OWN_SMTP_HOST: 'h', EMAIL_OWN_SMTP_PORT: '2525', EMAIL_OWN_KINDS: 'welcome, password-changed ,', EMAIL_OWN_SHARE: '250' });
    expect(c).toMatchObject({ port: 2525, share: 100 });
    expect([...c!.kinds]).toEqual(['welcome', 'password-changed']);
    expect(getOwnMailConfig({ EMAIL_OWN_SMTP_HOST: 'h', EMAIL_OWN_SHARE: 'x', EMAIL_OWN_SMTP_PORT: '99999' })).toMatchObject({ port: 25, share: 0 });
  });

  it('routes only listed kinds, never mass mail, and nothing at share 0', () => {
    expect(shouldUseOwnTransport(message, config)).toBe(true);
    expect(shouldUseOwnTransport({ ...message, kind: 'email-verification' }, config)).toBe(false);
    expect(shouldUseOwnTransport({ ...message, stream: 'news' }, config)).toBe(false);
    expect(shouldUseOwnTransport(message, { ...config, share: 0 })).toBe(false);
    expect(shouldUseOwnTransport(message, null)).toBe(false);
  });

  it('splits recipients deterministically by a hash of the address (case-insensitive)', () => {
    expect(recipientBucket('A@Example.com')).toBe(recipientBucket(' a@example.com '));
    const addresses = Array.from({ length: 2000 }, (_, i) => `user${i}@example.com`);
    const share = addresses.filter((to) => shouldUseOwnTransport({ ...message, to }, { ...config, share: 10 })).length;
    expect(share).toBeGreaterThan(130);
    expect(share).toBeLessThan(270);
    // Raising the share only adds recipients: nobody who was on the own path leaves it.
    const at10 = addresses.filter((to) => recipientBucket(to) < 10);
    expect(at10.every((to) => recipientBucket(to) < 30)).toBe(true);
  });
});

describe('sendViaOwnMail', () => {
  beforeEach(() => sendMail.mockReset());

  it('submits with the lab envelope sender, keeps the visible From and returns the Postfix queue id', async () => {
    sendMail.mockResolvedValue({ response: '250 2.0.0 Ok: queued as 4F3A1B2C3D', messageId: '<x@y>' });
    const r = await sendViaOwnMail(message, config, { sendMail } as never);
    expect(r).toEqual({ ok: true, id: '4F3A1B2C3D' });
    const arg = sendMail.mock.calls[0][0];
    expect(arg).toMatchObject({ from: message.from, to: 'a@example.com', replyTo: 'support@pawelperfect.com', envelope: { from: 'lab@lab.pawelperfect.com', to: ['a@example.com'] } });
    expect(arg.messageId).toMatch(/^<[0-9a-f-]{36}@pawelperfect\.com>$/);
  });

  it('maps connection failures to a status-less error and SMTP rejections to their code', async () => {
    sendMail.mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNECTION' }));
    expect(await sendViaOwnMail(message, config, { sendMail } as never)).toEqual({
      ok: false, error: { name: 'own_smtp_econnection', message: 'connect ECONNREFUSED', statusCode: null },
    });
    expect(mapOwnMailError(Object.assign(new Error('Relay access denied'), { responseCode: 554 }))).toMatchObject({ name: 'own_smtp_rejected', statusCode: 554 });
  });

  it('extracts the queue id only from a Postfix acceptance line', () => {
    expect(extractQueueId('250 2.0.0 Ok: queued as ABC123')).toBe('ABC123');
    expect(extractQueueId('250 OK')).toBeNull();
    expect(extractQueueId(undefined)).toBeNull();
  });
});

describe('sendEmail with the own path', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    resetOwnMailTransportForTests();
    sendMail.mockReset();
    emailsSend.mockReset();
    emailsSend.mockResolvedValue({ data: { id: 'resend-1' }, error: null });
    process.env.RESEND_API_KEY = 're_test';
    delete process.env.EMAIL_PROVIDER;
    process.env.EMAIL_OWN_SMTP_HOST = 'pp-mail-lab';
    process.env.EMAIL_OWN_KINDS = 'welcome';
    process.env.EMAIL_OWN_SHARE = '100';
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  const welcome = { to: 'a@example.com', subject: 'Hi', html: '<p>x</p>', language: 'en' as const, kind: 'welcome' };

  it('delivers through the own server and does not touch Resend', async () => {
    sendMail.mockResolvedValue({ response: '250 2.0.0 Ok: queued as Q1' });
    expect(await sendEmail(welcome)).toEqual({ ok: true, id: 'Q1' });
    expect(emailsSend).not.toHaveBeenCalled();
    expect(sendMail.mock.calls[0][0].headers['Auto-Submitted']).toBe('auto-generated');
  });

  it('falls back to the primary provider when the own server fails', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
    expect(await sendEmail(welcome)).toEqual({ ok: true, id: 'resend-1' });
    expect(emailsSend).toHaveBeenCalledTimes(1);
  });

  it('keeps other kinds and mass mail on the primary provider', async () => {
    await sendEmail({ ...welcome, kind: 'email-verification' });
    await sendEmail({ ...welcome, stream: 'news' });
    expect(sendMail).not.toHaveBeenCalled();
    expect(emailsSend).toHaveBeenCalledTimes(2);
  });

  it('is fully off when no host is configured', async () => {
    delete process.env.EMAIL_OWN_SMTP_HOST;
    await sendEmail(welcome);
    expect(sendMail).not.toHaveBeenCalled();
    expect(emailsSend).toHaveBeenCalledTimes(1);
  });
});
