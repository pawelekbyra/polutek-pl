import { Resend } from "resend";
import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import { htmlToPlainText, wrapEmailDocument } from "../domain/email-content";
import { toHeaderText } from "../domain/render-email";
import type { EmailSendError, EmailSendResult } from "../domain/email-provider";
import { getOwnMailConfig, sendViaOwnMail, shouldUseOwnTransport } from "./own-mail.transport";
import { isProviderUnavailable, postmarkToken, sendViaPostmark, type PostmarkMessage } from "./postmark-email.transport";
import { getSesConfig, isSesUnavailable, sendViaSes } from "./ses-email.transport";

/**
 * The one place that hands mail to Resend. Every automatic mail (system mails, broadcasts, broadcast
 * tests) goes through sendEmail(), so all of them get the same document wrapper, plain-text part,
 * sender, Reply-To, headers and tags.
 */

/**
 * Display name every automatic email shows as its sender, and the brand name used in subjects and
 * bodies ({{brandName}}). Normal case on purpose: an all-caps, domain-looking sender name and a
 * "www.…" in the subject are classic spam/phishing signals (Hotmail/Outlook sent our first
 * verification mail to Junk on a new domain). The address is @pawelperfect.com, the domain verified
 * for sending in Resend.
 */
export const EMAIL_SENDER_NAME = 'Pawel Perfect';

/** Physical identity line under every automatic mail (same entity as the Terms and Privacy Policy). */
export const EMAIL_IDENTITY_LINE = 'Paweł Perfect · ul. Złota 75, 00-819 Warszawa · support@pawelperfect.com';

/**
 * Tag on every mail this app sends. The Resend account is shared with PP Support, and webhooks are
 * per account, so the webhook acts only on events that carry this tag.
 */
export const APP_EMAIL_TAG = { name: 'app', value: 'pawelperfect' } as const;

/**
 * Sender address. EMAIL_FROM may be a bare address ("no-reply@pawelperfect.com"); then inboxes
 * showed "no-reply" as the sender, so a bare address gets the brand display name added.
 */
export function getEmailFrom(): string {
  const raw = (process.env.EMAIL_FROM || '').trim();
  if (!raw) return `${EMAIL_SENDER_NAME} <no-reply@pawelperfect.com>`;
  if (raw.includes('<')) return raw;
  return `${EMAIL_SENDER_NAME} <${raw}>`;
}

/**
 * Sender of mass mail (broadcasts: new-video notifications and newsletters). Lives on its own
 * subdomain (EMAIL_FROM_NEWS, e.g. "newsletter@news.pawelperfect.com") with its own DKIM and
 * Return-Path, so complaints about mass mail can never lower the reputation of the domain that sends
 * sign-up, password-reset and payment mail. Unset (domain not verified in Resend yet): falls back to
 * the transactional sender, so nothing breaks before the switch.
 */
export function getNewsEmailFrom(): string {
  const raw = (process.env.EMAIL_FROM_NEWS || '').trim();
  if (!raw) return getEmailFrom();
  if (raw.includes('<')) return raw;
  return `${EMAIL_SENDER_NAME} <${raw}>`;
}

/**
 * Automatic mail goes out from a no-reply address, but people do reply to it. Replies must land in
 * the real support mailbox (support@, routed to PP Support), so every send carries this Reply-To.
 */
function getEmailReplyTo(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || 'support@pawelperfect.com';
}

export type EmailUnsubscribe = {
  /** RFC 8058 one-click target (POST); goes into List-Unsubscribe. */
  oneClickUrl: string;
  /** Mandatory footer HTML with the visible unsubscribe link (broadcasts). */
  footerHtml?: string;
};

export type OutgoingEmail = {
  to: string;
  subject: string;
  /** Rendered template fragment (or a complete document). */
  html: string;
  language: 'pl' | 'en';
  /** Kind of mail, sent as a Resend tag (letters, digits, `_` and `-` only). */
  kind: string;
  /** Present only for mail a recipient can unsubscribe from (never security or payment mail). */
  unsubscribe?: EmailUnsubscribe | null;
  /** 'news' = mass mail, sent from the separate news sender (getNewsEmailFrom). Default: transactional. */
  stream?: 'news';
  /** Resend deduplicates sends with the same key for 24 h (safe retries). */
  idempotencyKey?: string;
  headers?: Record<string, string>;
};


export type { EmailSendError, EmailSendResult };

/**
 * Every mail is machine-generated: say so (RFC 3834) so auto-responders stay quiet, and give each
 * message a unique reference so mail clients never thread unrelated sends together.
 * List-Unsubscribe + List-Unsubscribe-Post (RFC 8058) only for mail with an unsubscribe target.
 */
export function buildEmailHeaders(unsubscribe?: EmailUnsubscribe | null, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Auto-Submitted': 'auto-generated',
    'X-Entity-Ref-ID': randomUUID(),
    ...(unsubscribe
      ? {
          'List-Unsubscribe': `<${unsubscribe.oneClickUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : {}),
    ...extra,
  };
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is missing');
  return new Resend(apiKey);
}

function toSendError(error: unknown): EmailSendError {
  if (error && typeof error === 'object') {
    const e = error as { name?: unknown; message?: unknown; statusCode?: unknown };
    return {
      name: typeof e.name === 'string' ? e.name : undefined,
      message: typeof e.message === 'string' ? e.message : 'Unknown email provider error',
      statusCode: typeof e.statusCode === 'number' ? e.statusCode : null,
    };
  }
  return { message: String(error) };
}

/**
 * Gmail Postmaster feedback loop: `Feedback-ID: campaign:stream:kind:SenderId` (values without colons,
 * SenderId last), so Gmail can report complaint rates per mail kind and per stream.
 */
export function buildFeedbackId(kind: string, stream?: 'news'): string {
  const clean = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 40);
  return `${clean(kind)}:${stream ?? 'tx'}:pp:ppmail`;
}

/** Which provider sends: Resend unless EMAIL_PROVIDER=ses or =postmark (and their credentials exist). */
export function getEmailProvider(env: Record<string, string | undefined> = process.env): 'resend' | 'postmark' | 'ses' {
  const wanted = env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (wanted === 'ses') {
    if (!getSesConfig(env)) {
      logger.error('[email] EMAIL_PROVIDER=ses but SES_SMTP_USER / SES_SMTP_PASS are not set: using Resend.');
      return 'resend';
    }
    return 'ses';
  }
  if (wanted !== 'postmark') return 'resend';
  if (!postmarkToken(env)) {
    logger.error('[email] EMAIL_PROVIDER=postmark but POSTMARK_SERVER_TOKEN is not set: using Resend.');
    return 'resend';
  }
  return 'postmark';
}

export async function sendEmail(input: OutgoingEmail): Promise<EmailSendResult> {
  const from = input.stream === 'news' ? getNewsEmailFrom() : getEmailFrom();
  if (!process.env.EMAIL_FROM && process.env.NODE_ENV === 'production') {
    logger.error('[email] EMAIL_FROM environment variable is NOT SET. Using fallback: ' + from);
  }

  const subject = toHeaderText(input.subject);
  const html = wrapEmailDocument({
    html: input.html,
    language: input.language,
    title: subject,
    identityLine: EMAIL_IDENTITY_LINE,
    footerHtml: input.unsubscribe?.footerHtml,
  });
  const text = htmlToPlainText(html);
  const replyTo = getEmailReplyTo();
  const headers = buildEmailHeaders(input.unsubscribe, {
    'Feedback-ID': buildFeedbackId(input.kind, input.stream),
    ...input.headers,
  });

  // Own server first for the kinds and share of recipients configured (EMAIL_OWN_*); any failure falls through
  // to the primary provider below, so the mail is not lost (a timeout after Postfix accepted can duplicate it).
  const ownConfig = getOwnMailConfig();
  if (ownConfig && shouldUseOwnTransport({ to: input.to, kind: input.kind, stream: input.stream }, ownConfig)) {
    const own = await sendViaOwnMail({ from, to: input.to, subject, html, text, replyTo, headers, kind: input.kind, stream: input.stream }, ownConfig);
    if (own.ok) return own;
    logger.error('[email] Own mail transport failed, falling back to the primary provider', { name: own.error.name, statusCode: own.error.statusCode });
  }

  const provider = getEmailProvider();
  if (provider === 'ses') {
    const result = await sendViaSes({ from, to: input.to, subject, html, text, replyTo, headers, kind: input.kind, stream: input.stream });
    // SES itself cannot send right now (outage, throttling, sandbox, rejected credentials): fall back to Resend
    // instead of losing the mail. Recipient problems (a bad address) are final, not retried elsewhere.
    if (result.ok || !isSesUnavailable(result.error) || !process.env.RESEND_API_KEY) {
      if (!result.ok) logger.error('[email] SES did not send', { name: result.error.name, statusCode: result.error.statusCode });
      return result;
    }
    logger.error('[email] SES unavailable, falling back to Resend', { name: result.error.name, statusCode: result.error.statusCode });
  }

  if (provider === 'postmark') {
    const message: PostmarkMessage = {
      from, to: input.to, subject, html, text, replyTo, headers,
      tag: input.kind,
      metadata: { [APP_EMAIL_TAG.name]: APP_EMAIL_TAG.value, kind: input.kind },
      stream: input.stream,
    };
    const result = await sendViaPostmark(message);
    // Postmark itself cannot send right now (outage, rejected token, account still in test mode): fall back to
    // Resend instead of losing the mail. Recipient problems (bad or suppressed address) are final, not retried.
    if (result.ok || !isProviderUnavailable(result.error) || !process.env.RESEND_API_KEY) {
      if (!result.ok) logger.error('[email] Postmark did not send', { name: result.error.name, statusCode: result.error.statusCode });
      return result;
    }
    logger.error('[email] Postmark unavailable, falling back to Resend', { name: result.error.name, statusCode: result.error.statusCode });
  }

  try {
    const { data, error } = await getResendClient().emails.send(
      {
        from,
        to: [input.to],
        subject,
        html,
        text,
        replyTo,
        headers,
        tags: [APP_EMAIL_TAG, { name: 'kind', value: input.kind }],
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );
    if (error) return { ok: false, error: toSendError(error) };
    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    return { ok: false, error: toSendError(error) };
  }
}
