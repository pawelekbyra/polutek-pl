import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock('@/lib/modules/email/application/handle-resend-webhook.use-case', () => ({ handleResendWebhook: handle }));
vi.mock('@/lib/feature-flags', () => ({ flags: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { classifyBounce, parsePostfixLog } from '@/lib/modules/email/domain/postfix-log';
import { ownEventId, processOwnMailEvents, toBounceEvent } from '@/lib/modules/email/application/process-own-mail-events';

const ts = '2026-10-09T18:00:01.123456+00:00 mail.pawelperfect.com';
const log = [
  `${ts} postfix/smtp[11]: 4F3A1B2C3D: to=<ok@gmail.com>, relay=gmail-smtp-in.l.google.com[1.2.3.4]:25, delay=1.2, delays=0.1/0.01/0.5/0.6, dsn=2.0.0, status=sent (250 2.0.0 OK 1234 x - gsmtp)`,
  `${ts} postfix/smtp[12]: 5A1B2C3D4E: to=<gone@gmail.com>, relay=gmail-smtp-in.l.google.com[1.2.3.4]:25, delay=1, dsn=5.1.1, status=bounced (host gmail-smtp-in.l.google.com[1.2.3.4] said: 550-5.1.1 The email account that you tried to reach does not exist. (in reply to RCPT TO command))`,
  `${ts} postfix/smtp[13]: 6B2C3D4E5F: to=<victim@outlook.com>, relay=outlook-com.olc.protection.outlook.com[5.6.7.8]:25, delay=2, dsn=5.7.1, status=bounced (host said: 550 5.7.1 Service unavailable, Client host [46.224.211.115] blocked using Barracuda; contact support)`,
  `${ts} postfix/smtp[14]: 7C3D4E5F60: to=<later@wp.pl>, relay=mx.wp.pl[9.9.9.9]:25, delay=9, dsn=4.2.0, status=deferred (greylisted)`,
  `${ts} postfix/smtp[15]: 8D4E5F6071: to=<full@example.org>, relay=mx.example.org[1.1.1.1]:25, delay=2, dsn=5.2.2, status=bounced (mailbox full)`,
  `${ts} postfix/qmgr[7]: 4F3A1B2C3D: from=<lab@lab.pawelperfect.com>, size=1234, nrcpt=1 (queue active)`,
  'garbage line',
].join('\n');

describe('parsePostfixLog', () => {
  it('reads only the final delivery lines, with queue id, recipient, DSN and timestamp', () => {
    const d = parsePostfixLog(log);
    expect(d.map((x) => [x.queueId, x.to, x.status, x.dsn])).toEqual([
      ['4F3A1B2C3D', 'ok@gmail.com', 'sent', '2.0.0'],
      ['5A1B2C3D4E', 'gone@gmail.com', 'bounced', '5.1.1'],
      ['6B2C3D4E5F', 'victim@outlook.com', 'bounced', '5.7.1'],
      ['7C3D4E5F60', 'later@wp.pl', 'deferred', '4.2.0'],
      ['8D4E5F6071', 'full@example.org', 'bounced', '5.2.2'],
    ]);
    expect(d[0].at).toBe('2026-10-09T18:00:01.123456+00:00');
  });
});

describe('classifyBounce', () => {
  it('separates address problems from blocks by the receiver, and never calls a block an address bounce', () => {
    expect(classifyBounce('5.1.1', 'user unknown')).toBe('address');
    expect(classifyBounce('5.1.10', 'RESOLVER.ADR.RecipientNotFound')).toBe('address');
    expect(classifyBounce('5.4.1', 'Recipient address rejected: Access denied')).toBe('address');
    expect(classifyBounce('5.7.1', 'Service unavailable, client blocked')).toBe('block');
    expect(classifyBounce('5.1.1', 'rejected, listed at zen.spamhaus.org')).toBe('block');
    expect(classifyBounce('5.2.2', 'mailbox full')).toBe('other');
    expect(classifyBounce('5.4.1', 'something else')).toBe('other');
  });
});

describe('processOwnMailEvents', () => {
  beforeEach(() => handle.mockReset().mockResolvedValue({ ok: true, data: {} }));
  const ctx = {} as never;

  it('suppresses only address-level hard bounces and reports blocks without addresses', async () => {
    const s = await processOwnMailEvents(ctx, log);
    expect(s).toMatchObject({ parsed: 5, sent: 1, deferred: 1, addressBounces: 1, blocks: 1, otherBounces: 1, errors: 0 });
    expect(handle).toHaveBeenCalledTimes(1);
    const event = handle.mock.calls[0][1];
    expect(event).toMatchObject({ type: 'email.bounced', data: { email_id: '5A1B2C3D4E', to: ['gone@gmail.com'], tags: { app: 'pawelperfect' }, bounce: { type: 'permanent' } } });
    expect(s.blockReasons[0]).toContain('5.7.1');
    expect(JSON.stringify(s)).not.toContain('victim@');
  });

  it('counts handler failures so the caller can retry the window', async () => {
    handle.mockResolvedValue({ ok: false, error: { message: 'x', statusCode: 503 } });
    expect((await processOwnMailEvents(ctx, log)).errors).toBe(1);
  });

  it('gives a repeat of the same log line the same address-free event id (idempotent)', () => {
    const [, bounce] = parsePostfixLog(log);
    expect(ownEventId(bounce)).toBe(ownEventId({ ...bounce }));
    expect(ownEventId(bounce)).toMatch(/^own:[0-9a-f]{24}$/);
    expect(toBounceEvent(bounce).eventId).not.toContain('gone');
  });
});
