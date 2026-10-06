/**
 * Mail configuration in ONE place: sender addresses, SES SMTP settings, limits. Amazon SES is the only transport.
 * Pure functions of an env record (no I/O), shared by the transport, the admin screens and env validation.
 */

type EnvRecord = Record<string, string | undefined>;

/** Display name of every automatic mail (normal case on purpose, see the transport for the reasoning). */
export const EMAIL_SENDER_NAME = 'Pawel Perfect';
export const DEFAULT_EMAIL_FROM = 'no-reply@pawelperfect.com';
export const DEFAULT_EMAIL_SUPPORT_FROM = 'support@pawelperfect.com';
export const DEFAULT_EMAIL_REPLY_TO = 'support@pawelperfect.com';

export const SES_DEFAULT_REGION = 'eu-north-1';

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
 * Daily / monthly send caps shown in the admin panel (EMAIL_DAILY_LIMIT / EMAIL_MONTHLY_LIMIT).
 * Defaults are the SES sandbox quota (200 per day); set the real quota after AWS grants production access.
 */
export function emailSendLimits(env: EnvRecord = process.env) {
  const num = (v: string | undefined) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  return {
    perDay: num(env.EMAIL_DAILY_LIMIT) ?? 200,
    perMonth: num(env.EMAIL_MONTHLY_LIMIT) ?? 6000,
    bounceTarget: 4,
    complaintTarget: 0.08,
  };
}


/**
 * Amazon SNS endpoint settings for bounce/complaint events. SES_SNS_TOPIC_ARN (comma-separated list allowed) is the
 * allowlist of topics we accept: unset means the endpoint refuses everything (fail closed).
 * SES_SNS_REGIONS adds regions whose sns.<region>.amazonaws.com may host the signing certificate (default: AWS_REGION).
 */
export function getSnsConfig(env: EnvRecord = process.env): { topicArns: string[]; regions: string[] } {
  const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const regions = list(env.SES_SNS_REGIONS);
  return {
    topicArns: list(env.SES_SNS_TOPIC_ARN),
    regions: regions.length ? regions : [env.AWS_REGION?.trim() || SES_DEFAULT_REGION],
  };
}
