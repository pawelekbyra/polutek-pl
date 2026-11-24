/**
 * Real Nodemailer, no mock of the library: our transports are run against a tiny in-process SMTP server so the error
 * shapes (`code`, `responseCode`, `command`) and the success `response` are the ones the installed Nodemailer produces,
 * not shapes we imagine. The other email tests mock `nodemailer` and hand-craft rejections; this file is what catches a
 * Nodemailer upgrade that changes them (docs/operations/EMAIL_SES.md, docs/operations/MAIL-OWN-TRANSPORT.md).
 * Loopback only, no network.
 */
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import nodemailer from 'nodemailer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only Resend (the fallback) and the app's own database/flags are faked: Nodemailer stays real.
const { emailsSend } = vi.hoisted(() => ({ emailsSend: vi.fn() }));
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: emailsSend } };
  }),
}));
vi.mock('@/lib/feature-flags', () => ({ flags: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { sendEmail } from '@/lib/modules/email/infrastructure/resend-email.transport';
import { resetOwnMailTransportForTests, sendViaOwnMail, type OwnMailConfig } from '@/lib/modules/email/infrastructure/own-mail.transport';
import { isSesUnavailable, resetSesTransportForTests, sendViaSes, type SesConfig } from '@/lib/modules/email/infrastructure/ses-email.transport';

type Replies = Partial<Record<'RCPT' | 'MAIL' | 'DATAEND' | 'AUTH', string>>;

const servers: net.Server[] = [];
const transports: Array<{ close(): void }> = [];

/** Minimal SMTP server: every command succeeds unless `replies` says otherwise (the reply text includes the status code). */
async function startFakeSmtp(replies: Replies = {}): Promise<{ port: number; commands: string[] }> {
  const commands: string[] = [];
  const server = net.createServer((socket) => {
    socket.on('error', () => undefined);
    socket.write('220 fake.test ESMTP\r\n');
    let buffer = '';
    let inData = false;
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let end: number;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            socket.write(`${replies.DATAEND ?? '250 2.0.0 Ok: queued as 4F3A1B2C3D'}\r\n`);
          }
          continue;
        }
        const command = line.split(' ')[0]!.toUpperCase();
        commands.push(command);
        if (command === 'EHLO') socket.write('250-fake.test\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (command === 'AUTH') socket.write(`${replies.AUTH ?? '235 2.7.0 Authentication successful'}\r\n`);
        else if (command === 'MAIL') socket.write(`${replies.MAIL ?? '250 2.1.0 Ok'}\r\n`);
        else if (command === 'RCPT') socket.write(`${replies.RCPT ?? '250 2.1.5 Ok'}\r\n`);
        else if (command === 'DATA') {
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          inData = true;
        } else if (command === 'QUIT') {
          socket.write('221 Bye\r\n');
          socket.end();
        } else socket.write('250 Ok\r\n');
      }
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { port: (server.address() as AddressInfo).port, commands };
}

/** A port nothing listens on: connecting is refused at once. */
async function closedPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

afterEach(async () => {
  resetOwnMailTransportForTests();
  resetSesTransportForTests();
  for (const t of transports.splice(0)) t.close();
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
});

const ownMessage = {
  from: 'Pawel Perfect <no-reply@pawelperfect.com>',
  to: 'a@example.com',
  subject: 'Temat z polskimi znakami: zażółć gęślą jaźń',
  html: '<p>x</p>',
  text: 'x',
  replyTo: 'support@pawelperfect.com',
  headers: { 'Auto-Submitted': 'auto-generated', 'List-Unsubscribe': '<https://www.pawelperfect.com/unsubscribe?t=abc>' },
  kind: 'welcome-email',
};
const ownConfig = (port: number): OwnMailConfig => ({ host: '127.0.0.1', port, envelopeFrom: 'lab@lab.pawelperfect.com', kinds: new Set(['welcome-email']), share: 100 });

/** A plain-SMTP transporter aimed at the fake server: stands in for the STARTTLS one of the SES path (no TLS in the fake). */
function plainTransport(port: number, auth?: { user: string; pass: string }) {
  const t = nodemailer.createTransport({ host: '127.0.0.1', port, secure: false, ignoreTLS: true, auth, connectionTimeout: 3_000, greetingTimeout: 3_000, socketTimeout: 5_000 });
  transports.push(t);
  return t;
}
const sesMessage = { ...ownMessage };
const sesConfig: SesConfig = { host: '127.0.0.1', port: 587, user: 'AKIAEXAMPLE', pass: 'secret', configurationSet: 'pp-events' };

describe('own mail transport against real Nodemailer', () => {
  it('delivers, hands over the envelope and takes the Postfix queue id from the real response', async () => {
    const smtp = await startFakeSmtp();
    const result = await sendViaOwnMail(ownMessage, ownConfig(smtp.port));
    expect(result).toEqual({ ok: true, id: '4F3A1B2C3D' });
    expect(smtp.commands).toEqual(expect.arrayContaining(['MAIL', 'RCPT', 'DATA']));
  });

  it('maps a permanent rejection at RCPT to own_smtp_rejected with its status', async () => {
    const smtp = await startFakeSmtp({ RCPT: '554 5.7.1 <a@example.com>: Relay access denied' });
    const result = await sendViaOwnMail(ownMessage, ownConfig(smtp.port));
    expect(result).toMatchObject({ ok: false, error: { name: 'own_smtp_rejected', statusCode: 554 } });
  });

  it('maps a temporary 4xx at RCPT and a server shutdown (421) to own_smtp_rejected with the real status', async () => {
    const busy = await startFakeSmtp({ RCPT: '450 4.2.0 Mailbox busy' });
    expect(await sendViaOwnMail(ownMessage, ownConfig(busy.port))).toMatchObject({ ok: false, error: { name: 'own_smtp_rejected', statusCode: 450 } });
    const closing = await startFakeSmtp({ MAIL: '421 4.3.2 Service shutting down' });
    expect(await sendViaOwnMail(ownMessage, ownConfig(closing.port))).toMatchObject({ ok: false, error: { name: 'own_smtp_rejected', statusCode: 421 } });
  });

  it('maps a refusal after DATA to own_smtp_rejected', async () => {
    const smtp = await startFakeSmtp({ DATAEND: '554 5.6.0 Message content rejected' });
    expect(await sendViaOwnMail(ownMessage, ownConfig(smtp.port))).toMatchObject({ ok: false, error: { name: 'own_smtp_rejected', statusCode: 554 } });
  });

  it('maps a refused connection to a status-less error named after the real code (ESOCKET, not ECONNREFUSED)', async () => {
    const result = await sendViaOwnMail(ownMessage, ownConfig(await closedPort()));
    expect(result).toMatchObject({ ok: false, error: { name: 'own_smtp_esocket', statusCode: null } });
  });

  it('raises errors carrying code, responseCode and command, the fields our mappers read', async () => {
    const smtp = await startFakeSmtp({ RCPT: '554 5.7.1 Relay access denied' });
    const error = await plainTransport(smtp.port).sendMail({ from: ownMessage.from, to: ownMessage.to, subject: 's', text: 't' }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'EENVELOPE', responseCode: 554, command: 'RCPT TO' });
  });
});

describe('SES transport against real Nodemailer', () => {
  it('delivers with our headers and takes the SES message id from the real response', async () => {
    const smtp = await startFakeSmtp({ DATAEND: '250 Ok 0102019abc-1111-2222-3333-444455556666-000000' });
    const result = await sendViaSes(sesMessage, sesConfig, plainTransport(smtp.port, { user: 'AKIAEXAMPLE', pass: 'secret' }));
    expect(result).toEqual({ ok: true, id: '0102019abc-1111-2222-3333-444455556666-000000' });
  });

  it('treats throttling (454 after DATA), rejected credentials (535) and a sandbox 554 as SES unavailable (fall back)', async () => {
    const throttled = await startFakeSmtp({ DATAEND: '454 Throttling failure: Maximum sending rate exceeded.' });
    const r1 = await sendViaSes(sesMessage, sesConfig, plainTransport(throttled.port));
    expect(r1).toMatchObject({ ok: false, error: { name: 'ses_smtp_454', statusCode: 454 } });
    expect(!r1.ok && isSesUnavailable(r1.error)).toBe(true);

    const badAuth = await startFakeSmtp({ AUTH: '535 Authentication Credentials Invalid' });
    const r2 = await sendViaSes(sesMessage, sesConfig, plainTransport(badAuth.port, { user: 'AKIAEXAMPLE', pass: 'wrong' }));
    expect(r2).toMatchObject({ ok: false, error: { name: 'ses_smtp_535', statusCode: 535 } });
    expect(!r2.ok && isSesUnavailable(r2.error)).toBe(true);

    const sandbox = await startFakeSmtp({ RCPT: '554 Message rejected: Email address is not verified.' });
    const r3 = await sendViaSes(sesMessage, sesConfig, plainTransport(sandbox.port));
    expect(r3).toMatchObject({ ok: false, error: { name: 'ses_smtp_554', statusCode: 554 } });
    expect(!r3.ok && isSesUnavailable(r3.error)).toBe(true);
  });

  it('treats a bad recipient address (501) as final, not as provider trouble', async () => {
    const smtp = await startFakeSmtp({ RCPT: '501 Invalid address syntax' });
    const result = await sendViaSes(sesMessage, sesConfig, plainTransport(smtp.port));
    expect(result).toMatchObject({ ok: false, error: { name: 'ses_smtp_501', statusCode: 501 } });
    expect(!result.ok && isSesUnavailable(result.error)).toBe(false);
  });

  it('treats a refused connection as provider trouble (no status, ses_esocket)', async () => {
    const result = await sendViaSes(sesMessage, sesConfig, plainTransport(await closedPort()));
    expect(result).toMatchObject({ ok: false, error: { name: 'ses_esocket', statusCode: null } });
    expect(!result.ok && isSesUnavailable(result.error)).toBe(true);
  });
});

describe('sendEmail falls back to Resend when the real Nodemailer path fails', () => {
  const saved = { ...process.env };
  const base = { to: 'a@example.com', subject: 's', html: '<p>x</p>', language: 'pl' as const, kind: 'welcome-email' };
  beforeEach(() => {
    emailsSend.mockReset();
    emailsSend.mockResolvedValue({ data: { id: 'rs_1' }, error: null });
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'Pawel Perfect <no-reply@pawelperfect.com>';
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_OWN_SMTP_HOST;
    delete process.env.SES_SMTP_USER;
    delete process.env.SES_SMTP_PASS;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('own path: a refused connection to Postfix sends the same mail through Resend', async () => {
    process.env.EMAIL_OWN_SMTP_HOST = '127.0.0.1';
    process.env.EMAIL_OWN_SMTP_PORT = String(await closedPort());
    process.env.EMAIL_OWN_KINDS = 'welcome-email';
    process.env.EMAIL_OWN_SHARE = '100';
    expect(await sendEmail(base)).toEqual({ ok: true, id: 'rs_1' });
    expect(emailsSend).toHaveBeenCalledTimes(1);
  });

  it('own path: a Postfix rejection (554) also falls back to Resend', async () => {
    const smtp = await startFakeSmtp({ RCPT: '554 5.7.1 Relay access denied' });
    process.env.EMAIL_OWN_SMTP_HOST = '127.0.0.1';
    process.env.EMAIL_OWN_SMTP_PORT = String(smtp.port);
    process.env.EMAIL_OWN_KINDS = 'welcome-email';
    process.env.EMAIL_OWN_SHARE = '100';
    expect(await sendEmail(base)).toEqual({ ok: true, id: 'rs_1' });
    expect(emailsSend).toHaveBeenCalledTimes(1);
  });

  it('SES path: an unreachable SMTP endpoint sends the same mail through Resend', async () => {
    process.env.EMAIL_PROVIDER = 'ses';
    process.env.SES_SMTP_USER = 'AKIAEXAMPLE';
    process.env.SES_SMTP_PASS = 'secret';
    process.env.SES_SMTP_HOST = '127.0.0.1';
    process.env.SES_SMTP_PORT = String(await closedPort());
    expect(await sendEmail(base)).toEqual({ ok: true, id: 'rs_1' });
    expect(emailsSend).toHaveBeenCalledTimes(1);
  });
});
