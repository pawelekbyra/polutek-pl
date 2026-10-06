#!/usr/bin/env node
/**
 * Sends ONE test message through the configured mail provider and prints provider, message id and, on failure,
 * a plain Polish hint. Never prints secrets. Refuses to run without credentials.
 *
 *   node scripts/ops/send-test-email.mjs [recipient]          (default pawel.perfect@gmail.com)
 *   node --env-file=/path/to/app.env scripts/ops/send-test-email.mjs
 *
 * Uses the same env as the app: EMAIL_PROVIDER (resend|ses, default resend), EMAIL_FROM, EMAIL_REPLY_TO,
 * RESEND_API_KEY | SES_SMTP_USER + SES_SMTP_PASS (+ AWS_REGION, SES_SMTP_HOST, SES_CONFIGURATION_SET).
 * This script is deliberately standalone (plain Node, no build); it mirrors lib/email-config.ts.
 */
import nodemailer from 'nodemailer';

const env = process.env;
const to = (process.argv[2] || 'pawel.perfect@gmail.com').trim();
const provider = (env.EMAIL_PROVIDER || '').trim().toLowerCase() === 'ses' ? 'ses' : 'resend';
const bare = (env.EMAIL_FROM || 'no-reply@pawelperfect.com').trim();
const from = bare.includes('<') ? bare : `Pawel Perfect <${bare}>`;
const replyTo = (env.EMAIL_REPLY_TO || 'support@pawelperfect.com').trim();
const region = (env.AWS_REGION || 'eu-north-1').trim();

const subject = `TAKT test poczty (${provider}) ${new Date().toISOString()}`;
const text = `Wiadomość testowa wysłana przez dostawcę: ${provider}.\nJeśli to czytasz, wysyłka działa.`;

function hintFor(err) {
  const code = err?.code || '';
  const smtp = err?.responseCode;
  const t = `${err?.message || ''} ${err?.response || ''}`.toLowerCase();
  if (code === 'EAUTH' || smtp === 535 || smtp === 530) return 'Dane logowania SMTP odrzucone: sprawdź SES_SMTP_USER i SES_SMTP_PASS (dane SMTP z konsoli SES, nie klucze IAM) oraz AWS_REGION.';
  if (smtp === 454 && t.includes('daily')) return 'Przekroczony dzienny limit SES (sandbox: ok. 200 na dobę).';
  if (smtp === 454) return 'Zbyt szybka wysyłka (SES: limit na sekundę). Spróbuj za chwilę.';
  if (smtp === 554 && t.includes('not verified')) return 'SES w trybie sandbox wysyła tylko do zweryfikowanych adresów (albo nadawca niezweryfikowany). Zweryfikuj odbiorcę w konsoli SES lub poproś o dostęp produkcyjny.';
  if (smtp === 554) return 'SES odrzucił wiadomość (treść, adres lub polityka konta).';
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'].includes(code)) return 'Brak połączenia z serwerem SMTP (sieć, zapora, port 587 wychodzący, host/region).';
  if (/401|403|invalid api key|restricted/i.test(t)) return 'Resend odrzucił klucz API lub nadawcę: sprawdź RESEND_API_KEY i zweryfikowaną domenę.';
  if (/429|rate/i.test(t)) return 'Limit wysyłki dostawcy (zbyt szybko albo wyczerpany limit dzienny).';
  return 'Nieznany błąd; szczegóły w komunikacie poniżej.';
}

function scrub(message) {
  let out = String(message || '');
  for (const secret of [env.SES_SMTP_PASS, env.SES_SMTP_USER, env.RESEND_API_KEY]) {
    if (secret && secret.length >= 4) out = out.split(secret).join('***');
  }
  return out.slice(0, 400);
}

async function viaSes() {
  const user = env.SES_SMTP_USER?.trim();
  const pass = env.SES_SMTP_PASS?.trim();
  if (!user || !pass) {
    console.error('Brak SES_SMTP_USER / SES_SMTP_PASS. Nic nie wysłano. Instrukcja: docs/operations/EMAIL_SES.md');
    process.exit(2);
  }
  const transporter = nodemailer.createTransport({
    host: env.SES_SMTP_HOST?.trim() || `email-smtp.${region}.amazonaws.com`,
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  const headers = { 'Auto-Submitted': 'auto-generated' };
  if (env.SES_CONFIGURATION_SET?.trim()) headers['X-SES-CONFIGURATION-SET'] = env.SES_CONFIGURATION_SET.trim();
  const info = await transporter.sendMail({ from, to, replyTo, subject, text, headers });
  const m = /^250 Ok (\S+)/i.exec(String(info.response || '').trim());
  return m ? m[1] : info.messageId;
}

async function viaResend() {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) {
    console.error('Brak RESEND_API_KEY. Nic nie wysłano.');
    process.exit(2);
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, reply_to: replyTo }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${body?.name || ''} ${body?.message || ''}`.trim());
    throw err;
  }
  return body.id;
}

console.log(`Dostawca: ${provider}`);
console.log(`Od: ${from}  Do: ${to}  Reply-To: ${replyTo}`);
try {
  const id = provider === 'ses' ? await viaSes() : await viaResend();
  console.log(`OK. Identyfikator wiadomości: ${id}`);
} catch (err) {
  console.error(`BŁĄD: ${scrub(err?.message)}`);
  console.error(`Podpowiedź: ${hintFor(err)}`);
  process.exit(1);
}
