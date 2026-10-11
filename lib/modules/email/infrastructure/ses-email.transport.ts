/**
 * Amazon SES as the main provider of sendEmail() (docs/operations/EMAIL_SES.md): plain SMTP to the SES endpoint of
 * the region the domain is verified in (Stockholm, eu-north-1), through nodemailer (already a dependency, the same
 * library the own-mail path uses). Selected by EMAIL_PROVIDER=ses; Resend stays the fallback, so a mail is not lost
 * when SES cannot send right now (outage, throttling, an account still in the sandbox, rejected credentials).
 *
 * Why SMTP and not the SESv2 API: the SMTP credentials are all it needs (no AWS SDK, no request signing), and the
 * message goes out exactly as built: our headers (List-Unsubscribe, Feedback-ID, Auto-Submitted), our From.
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailSendError, EmailSendResult } from "../domain/email-provider";

type Env = Record<string, string | undefined>;

export type SesConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** Optional SES configuration set (event publishing, e.g. to SNS); sent as X-SES-CONFIGURATION-SET. */
  configurationSet: string | null;
};

export type SesMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string;
  headers: Record<string, string>;
  /** Kind of mail, sent as an SES message tag. */
  kind: string;
  stream?: "news";
};

export const SES_DEFAULT_HOST = "email-smtp.eu-north-1.amazonaws.com";

/** null = SES not configured (no SMTP credentials). */
export function getSesConfig(env: Env = process.env): SesConfig | null {
  const user = env.SES_SMTP_USER?.trim();
  const pass = env.SES_SMTP_PASS?.trim();
  if (!user || !pass) return null;
  const port = Number.parseInt(env.SES_SMTP_PORT ?? "", 10);
  return {
    host: env.SES_SMTP_HOST?.trim() || SES_DEFAULT_HOST,
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 587,
    user,
    pass,
    configurationSet: env.SES_CONFIGURATION_SET?.trim() || null,
  };
}

let cached: { key: string; transporter: Transporter } | null = null;

function getTransporter(config: SesConfig): Transporter {
  const key = `${config.host}|${config.port}|${config.user}`;
  if (cached?.key === key) return cached.transporter;
  cached?.transporter.close();
  const implicitTls = config.port === 465;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: implicitTls,
    // Port 587: STARTTLS is required, never a plain-text login.
    requireTLS: !implicitTls,
    auth: { user: config.user, pass: config.pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 20_000,
  });
  cached = { key, transporter };
  return transporter;
}

/** Test helper: forget the cached transporter. */
export function resetSesTransportForTests(): void {
  cached?.transporter.close();
  cached = null;
}

/** SES message tag values allow letters, digits, `_`, `-`, `.`, `@` (max 256). */
function tagValue(value: string): string {
  return value.replace(/[^A-Za-z0-9_.@-]/g, "-").slice(0, 100) || "unknown";
}

/** The headers SES adds on top of ours: message tags (app, kind, stream) and the optional configuration set. */
export function buildSesHeaders(message: Pick<SesMessage, "headers" | "kind" | "stream">, config: Pick<SesConfig, "configurationSet">): Record<string, string> {
  return {
    ...message.headers,
    "X-SES-MESSAGE-TAGS": `app=pawelperfect, kind=${tagValue(message.kind)}, stream=${message.stream ?? "tx"}`,
    ...(config.configurationSet ? { "X-SES-CONFIGURATION-SET": config.configurationSet } : {}),
  };
}

/** SES answers "250 Ok 0101019...-uuid-000000": that id is what SES events (bounces, complaints) carry. */
export function extractSesMessageId(response: unknown): string | null {
  if (typeof response !== "string") return null;
  return /^250 Ok\s+([A-Za-z0-9-]+)/i.exec(response.trim())?.[1] ?? null;
}

export function mapSesError(error: unknown): EmailSendError {
  const e = (error && typeof error === "object" ? error : {}) as { code?: unknown; responseCode?: unknown; message?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  const smtp = typeof e.responseCode === "number" ? e.responseCode : null;
  const message = (typeof e.message === "string" ? e.message : String(error)).slice(0, 300);
  if (smtp) return { name: `ses_smtp_${smtp}`, message, statusCode: smtp };
  // Connection-level failure (DNS, TLS, timeout, refused): no SMTP status at all.
  return { name: code ? `ses_${code.toLowerCase()}` : "ses_failed", message, statusCode: null };
}

/**
 * True when SES itself cannot send right now (the caller may try another provider); false when the recipient or the
 * message is the problem (an invalid address): that is final and not retried elsewhere.
 */
export function isSesUnavailable(error: EmailSendError): boolean {
  const status = error.statusCode;
  if (status == null) return true;
  if (status >= 400 && status < 500) return true; // 454 throttling / daily quota, 421 busy, 451 local error
  if (status === 530 || status === 535 || status === 538) return true; // credentials rejected
  // 554 "Email address is not verified" (account still in the sandbox), suspended or paused account.
  return /not verified|sandbox|suspend|paus|quota|rate exceeded|throttl|credentials/i.test(error.message);
}

export async function sendViaSes(
  message: SesMessage,
  config: SesConfig | null = getSesConfig(),
  transporter?: Pick<Transporter, "sendMail">,
): Promise<EmailSendResult> {
  if (!config) return { ok: false, error: { name: "SesNotConfigured", message: "SES_SMTP_USER or SES_SMTP_PASS is missing", statusCode: null } };
  try {
    const info = await (transporter ?? getTransporter(config)).sendMail({
      from: message.from,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: buildSesHeaders(message, config),
    });
    return { ok: true, id: extractSesMessageId(info.response) ?? (typeof info.messageId === "string" ? info.messageId : null) };
  } catch (error) {
    return { ok: false, error: mapSesError(error) };
  }
}
