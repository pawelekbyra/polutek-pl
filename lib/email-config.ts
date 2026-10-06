/**
 * Mail configuration in ONE place: which provider sends, sender addresses, limits.
 * Pure functions of an env record (no I/O), shared by the transport, the admin screens and env validation.
 */

export type EmailProvider = 'resend' | 'ses';
type EnvRecord = Record<string, string | undefined>;

/** Display name of every automatic mail (normal case on purpose, see the transport for the reasoning). */
export const EMAIL_SENDER_NAME = 'Pawel Perfect';
export const DEFAULT_EMAIL_FROM = 'no-reply@pawelperfect.com';
export const DEFAULT_EMAIL_SUPPORT_FROM = 'support@pawelperfect.com';
export const DEFAULT_EMAIL_REPLY_TO = 'support@pawelperfect.com';

export const SES_DEFAULT_REGION = 'eu-north-1';

/** Provider switch. Anything but an explicit "ses" means Resend (the safe default until the owner flips it). */
export function resolveEmailProvider(env: EnvRecord = process.env): EmailProvider {
  return env.EMAIL_PROVIDER?.trim().toLowerCase() === 'ses' ? 'ses' : 'resend';
}

/** True when EMAIL_PROVIDER holds something we do not recognise (validation reports it). */
export function isUnknownEmailProvider(env: EnvRecord = process.env): boolean {
  const raw = env.EMAIL_PROVIDER?.trim().toLowerCase();
  return !!raw && raw !== 'ses' && raw !== 'resend';
}

/** A bare address gets the brand display name; "Name <addr>" is kept as configured. */
function withDisplayName(raw: string | undefined, fallbackAddress: string): string {
  const value = (raw || '').trim();
  if (!value) return `${EMAIL_SENDER_NAME} <${fallbackAddress}>`;
  return value.includes('<') ? value : `${EMAIL_SENDER_NAME} <${value}>`;
}

/** System and account mail (sign-up, password, confirmations, broadcasts). */
export function getEmailFrom(env: EnvRecord = process.env): string {
  return withDisplayName(env.EMAIL_FROM, DEFAULT_EMAIL_FROM);
}

/** Mail that originates from support work (a person answering a ticket). */
export function getEmailSupportFrom(env: EnvRecord = process.env): string {
  return withDisplayName(env.EMAIL_SUPPORT_FROM, DEFAULT_EMAIL_SUPPORT_FROM);
}

/** Replies to no-reply mail must land in the real support mailbox. */
export function getEmailReplyTo(env: EnvRecord = process.env): string {
  return env.EMAIL_REPLY_TO?.trim() || DEFAULT_EMAIL_REPLY_TO;
}

export type SesSmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  region: string;
  configurationSet: string | null;
};

export function getSesSmtpConfig(env: EnvRecord = process.env): SesSmtpConfig | null {
  const user = env.SES_SMTP_USER?.trim();
  const pass = env.SES_SMTP_PASS?.trim();
  if (!user || !pass) return null;
  const region = env.AWS_REGION?.trim() || SES_DEFAULT_REGION;
  return {
    host: env.SES_SMTP_HOST?.trim() || `email-smtp.${region}.amazonaws.com`,
    port: 587,
    user,
    pass,
    region,
    configurationSet: env.SES_CONFIGURATION_SET?.trim() || null,
  };
}

/**
 * Daily / monthly send caps shown in the admin panel. EMAIL_*_LIMIT wins, the old RESEND_*_LIMIT names still work.
 * Defaults per provider: Resend Free 100/3000; SES sandbox 200 per day (production access raises it; set the real quota).
 */
export function emailSendLimits(env: EnvRecord = process.env) {
  const provider = resolveEmailProvider(env);
  const num = (...values: (string | undefined)[]) => {
    for (const v of values) if (Number.isFinite(Number(v)) && Number(v) > 0) return Number(v);
    return null;
  };
  const defaults = provider === 'ses' ? { perDay: 200, perMonth: 6000 } : { perDay: 100, perMonth: 3000 };
  return {
    provider,
    perDay: num(env.EMAIL_DAILY_LIMIT, env.RESEND_DAILY_LIMIT) ?? defaults.perDay,
    perMonth: num(env.EMAIL_MONTHLY_LIMIT, env.RESEND_MONTHLY_LIMIT) ?? defaults.perMonth,
    bounceTarget: 4,
    complaintTarget: 0.08,
  };
}

/** Whether bounce/complaint events reach the app. Only the Resend webhook exists; SES has none yet (SNS follow-up). */
export function bounceEventsConnected(env: EnvRecord = process.env): boolean {
  return resolveEmailProvider(env) === 'resend';
}
