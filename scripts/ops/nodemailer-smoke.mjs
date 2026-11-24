/**
 * Manual smoke test of the two Nodemailer paths after a Nodemailer upgrade (docs/operations/NODEMAILER-10.md).
 * Uses the SAME transport options as lib/modules/email/infrastructure/own-mail.transport.ts and ses-email.transport.ts
 * (keep them in sync). Standalone: needs only the `nodemailer` package next to it, no repository code.
 *
 *   node nodemailer-smoke.mjs own|ses            verify only: connect, STARTTLS, AUTH; sends NO mail
 *   node nodemailer-smoke.mjs own|ses --send     also sends ONE test message to the owner (only with the owner's consent)
 *
 * Environment (same names as app.env): EMAIL_OWN_SMTP_HOST, EMAIL_OWN_SMTP_PORT, EMAIL_OWN_ENVELOPE_FROM,
 * SES_SMTP_USER, SES_SMTP_PASS, SES_SMTP_HOST, SES_SMTP_PORT, EMAIL_FROM. Secrets are never printed.
 */
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';

const [mode, ...flags] = process.argv.slice(2);
const send = flags.includes('--send');
const OWNER = 'pawel.perfect@gmail.com';
const env = process.env;
const from = env.EMAIL_FROM?.trim() || 'Pawel Perfect <no-reply@pawelperfect.com>';

function ownTransport() {
  const host = env.EMAIL_OWN_SMTP_HOST?.trim();
  if (!host) throw new Error('EMAIL_OWN_SMTP_HOST is not set');
  const port = Number.parseInt(env.EMAIL_OWN_SMTP_PORT ?? '', 10) || 25;
  return {
    label: `own SMTP ${host}:${port}`,
    transporter: nodemailer.createTransport({
      host, port, secure: false, ignoreTLS: true, pool: true, maxConnections: 2, maxMessages: 100,
      connectionTimeout: 5_000, greetingTimeout: 5_000, socketTimeout: 20_000,
    }),
    envelope: { from: env.EMAIL_OWN_ENVELOPE_FROM?.trim() || 'lab@lab.pawelperfect.com', to: [OWNER] },
    extraHeaders: {},
    messageId: `<${randomUUID()}@pawelperfect.com>`,
  };
}

function sesTransport() {
  const user = env.SES_SMTP_USER?.trim();
  const pass = env.SES_SMTP_PASS?.trim();
  if (!user || !pass) throw new Error('SES_SMTP_USER / SES_SMTP_PASS are not set');
  const host = env.SES_SMTP_HOST?.trim() || 'email-smtp.eu-north-1.amazonaws.com';
  const port = Number.parseInt(env.SES_SMTP_PORT ?? '', 10) || 587;
  const implicitTls = port === 465;
  return {
    label: `SES SMTP ${host}:${port}`,
    transporter: nodemailer.createTransport({
      host, port, secure: implicitTls, requireTLS: !implicitTls, auth: { user, pass },
      pool: true, maxConnections: 3, maxMessages: 100,
      connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 20_000,
    }),
    envelope: undefined,
    extraHeaders: { 'X-SES-MESSAGE-TAGS': 'app=pawelperfect, kind=smoke-test, stream=tx' },
    messageId: undefined,
  };
}

function describeError(error) {
  const e = error && typeof error === 'object' ? error : {};
  return { code: e.code, originalCode: e.originalCode, responseCode: e.responseCode, command: e.command, permanent: e.permanent, message: String(e.message ?? error).slice(0, 300) };
}

if (mode !== 'own' && mode !== 'ses') {
  console.error('usage: node nodemailer-smoke.mjs own|ses [--send]');
  process.exit(2);
}

const t = mode === 'own' ? ownTransport() : sesTransport();
console.log(`target: ${t.label}`);
let code = 0;
try {
  await t.transporter.verify();
  console.log('verify: OK (connection, STARTTLS where required, AUTH where configured)');
  if (send) {
    const info = await t.transporter.sendMail({
      from,
      to: OWNER,
      subject: `Nodemailer smoke test (${mode}) ${new Date().toISOString()}`,
      text: 'Test message after the Nodemailer upgrade. Safe to delete.',
      html: '<p>Test message after the Nodemailer upgrade. Safe to delete.</p>',
      headers: { 'Auto-Submitted': 'auto-generated', ...t.extraHeaders },
      ...(t.envelope ? { envelope: t.envelope } : {}),
      ...(t.messageId ? { messageId: t.messageId } : {}),
    });
    console.log('send: OK', JSON.stringify({ response: info.response, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected }));
  } else {
    console.log('send: skipped (no --send)');
  }
} catch (error) {
  code = 1;
  console.error('FAILED', JSON.stringify(describeError(error)));
}
t.transporter.close();
process.exit(code);
