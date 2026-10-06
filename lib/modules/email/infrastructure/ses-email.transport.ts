import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getSesSmtpConfig, type SesSmtpConfig } from "@/lib/email-config";
import { logger } from "@/lib/logger";
import type { EmailSendError, EmailSendResult } from "../domain/email-provider";
import type { PreparedEmail } from "./email.transport";

/**
 * Amazon SES adapter (EMAIL_PROVIDER=ses): SMTP via nodemailer, STARTTLS on port 587, credentials from
 * SES_SMTP_USER / SES_SMTP_PASS (SMTP credentials created in the SES console, not IAM access keys).
 * Sources: docs/operations/EMAIL_SES.md.
 */

let cached: { key: string; transporter: Transporter } | null = null;

function getTransporter(config: SesSmtpConfig): Transporter {
  const key = `${config.host}|${config.port}|${config.user}`;
  if (cached?.key === key) return cached.transporter;
  cached?.transporter.close();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false, // plain connect, then upgrade
    requireTLS: true, // STARTTLS is mandatory: never send credentials in the clear
    auth: { user: config.user, pass: config.pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  cached = { key, transporter };
  return transporter;
}

/** Test helper: forget the cached transporter. */
export function resetSesTransportForTests(): void {
  cached?.transporter.close();
  cached = null;
}

/** Polish operator hints for the failures a new SES account hits first. */
const HINTS = {
  not_verified:
    'SES odrzucił adres: konto jest w trybie sandbox (wysyłka tylko do zweryfikowanych adresów) albo nadawca nie jest zweryfikowany. Zweryfikuj odbiorcę w konsoli SES lub poproś o dostęp produkcyjny (Request production access).',
  daily_quota: 'Przekroczony dzienny limit SES (w sandboxie ok. 200 wiadomości na dobę). Wysyłka wznowi się po zresetowaniu limitu; produkcyjny dostęp podnosi limit.',
  throttled: 'Zbyt szybka wysyłka (limit SES; w sandboxie 1 wiadomość na sekundę). Aplikacja poczeka i spróbuje ponownie.',
  auth: 'SES odrzucił dane logowania SMTP. Sprawdź SES_SMTP_USER i SES_SMTP_PASS (to dane SMTP z konsoli SES, nie klucze dostępu IAM) oraz region AWS_REGION.',
  connection: 'Brak połączenia z serwerem SMTP SES (sieć, zapora lub zły region/host). Port wychodzący 587 musi być otwarty.',
  rejected: 'SES odrzucił wiadomość (treść, adres lub polityka konta). Szczegóły w komunikacie błędu.',
  size: 'Wiadomość przekracza limit rozmiaru SES.',
  temporary: 'Chwilowy błąd SES, aplikacja ponowi próbę.',
} as const;

/** Replaces credentials if they ever appear in an error text. */
function scrub(text: string, config: SesSmtpConfig | null): string {
  let out = text;
  for (const secret of [config?.pass, config?.user]) if (secret && secret.length >= 4) out = out.split(secret).join('***');
  return out.slice(0, 500);
}

/**
 * Maps a nodemailer/SES failure to the provider-neutral error the rest of the app understands
 * (the broadcast queue classifies by `name` and `statusCode`; see classifySendFailure).
 */
export function mapSesError(error: unknown, config: SesSmtpConfig | null = null): EmailSendError {
  const e = (error && typeof error === 'object' ? error : {}) as { code?: unknown; responseCode?: unknown; response?: unknown; message?: unknown; command?: unknown };
  const message = scrub(typeof e.message === 'string' ? e.message : String(error), config);
  const response = typeof e.response === 'string' ? e.response : '';
  const text = `${message} ${scrub(response, config)}`.toLowerCase();
  const smtp = typeof e.responseCode === 'number' ? e.responseCode : null;
  const code = typeof e.code === 'string' ? e.code : '';

  if (code === 'EAUTH' || smtp === 535 || smtp === 530 || smtp === 534) {
    return { name: 'smtp_auth_failed', message, statusCode: 401, hint: HINTS.auth };
  }
  if (smtp === 454 || text.includes('throttling failure') || text.includes('maximum sending rate exceeded')) {
    if (text.includes('daily message quota exceeded') || text.includes('daily sending quota')) {
      return { name: 'daily_quota_exceeded', message, statusCode: 429, hint: HINTS.daily_quota };
    }
    return { name: 'rate_limit_exceeded', message, statusCode: 429, hint: HINTS.throttled };
  }
  if (smtp === 554 && (text.includes('not verified') || text.includes('email address is not verified'))) {
    return { name: 'message_rejected_not_verified', message, statusCode: 554, hint: HINTS.not_verified };
  }
  if (smtp === 554 || text.includes('messagerejected') || text.includes('message rejected')) {
    return { name: 'message_rejected', message, statusCode: 554, hint: HINTS.rejected };
  }
  if (smtp === 552) return { name: 'message_too_large', message, statusCode: 552, hint: HINTS.size };
  if (smtp === 421 || smtp === 450 || smtp === 451 || smtp === 452) {
    return { name: 'smtp_temporary_failure', message, statusCode: 503, hint: HINTS.temporary };
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'ENOTFOUND', 'EDNS', 'ETLS', 'ECONNRESET'].includes(code)) {
    // No HTTP-like status: the queue treats it as temporary.
    return { name: 'smtp_connection_failed', message, statusCode: null, hint: HINTS.connection };
  }
  return { name: code || undefined, message: message || 'Unknown email provider error', statusCode: smtp, hint: undefined };
}

/** SES answers "250 Ok <message id>"; fall back to nodemailer's Message-ID header. */
function extractMessageId(info: { response?: unknown; messageId?: unknown }): string | null {
  if (typeof info.response === 'string') {
    const match = /^250 Ok (\S+)/i.exec(info.response.trim());
    if (match) return match[1];
  }
  return typeof info.messageId === 'string' ? info.messageId : null;
}

export async function sendViaSes(mail: PreparedEmail): Promise<EmailSendResult> {
  const config = getSesSmtpConfig();
  if (!config) {
    return {
      ok: false,
      error: { name: 'smtp_credentials_missing', message: 'SES_SMTP_USER / SES_SMTP_PASS are missing', statusCode: null, hint: HINTS.auth },
    };
  }

  const headers: Record<string, string> = { ...mail.headers };
  if (config.configurationSet) {
    headers['X-SES-CONFIGURATION-SET'] = config.configurationSet;
    headers['X-SES-MESSAGE-TAGS'] = mail.tags.map((t) => `${t.name}=${t.value}`).join(', ');
  }

  try {
    const info = await getTransporter(config).sendMail({
      from: mail.from,
      to: mail.to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers,
    });
    return { ok: true, id: extractMessageId(info) };
  } catch (error) {
    const mapped = mapSesError(error, config);
    logger.warn('[email] SES send failed', { name: mapped.name, statusCode: mapped.statusCode });
    return { ok: false, error: mapped };
  }
}
