import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import {
  EMAIL_SENDER_NAME,
  getEmailFrom,
  getEmailReplyTo,
  getEmailSupportFrom,
} from "@/lib/email-config";
import { htmlToPlainText, wrapEmailDocument } from "../domain/email-content";
import { toHeaderText } from "../domain/render-email";
import type { EmailSendError, EmailSendResult } from "../domain/email-provider";
import { sendViaSes } from "./ses-email.transport";

/**
 * The one place that hands mail to Amazon SES (SMTP). Every automatic mail (system mails, broadcasts, broadcast
 * tests) goes through sendEmail(), so all of them get the same document wrapper, plain-text part,
 * sender, Reply-To and headers. Sender addresses and Reply-To live in lib/email-config.ts.
 */

/**
 * Display name every automatic email shows as its sender, and the brand name used in subjects and
 * bodies ({{brandName}}). Normal case on purpose: an all-caps, domain-looking sender name and a
 * "www.…" in the subject are classic spam/phishing signals (Hotmail/Outlook sent our first
 * verification mail to Junk on a new domain). The address is @pawelperfect.com, a domain verified
 * for sending in Amazon SES.
 */
export { EMAIL_SENDER_NAME, getEmailFrom };

/** Physical identity line under every automatic mail (same entity as the Terms and Privacy Policy). */
export const EMAIL_IDENTITY_LINE = 'Paweł Perfect · ul. Złota 75, 00-819 Warszawa · support@pawelperfect.com';

/**
 * Tag on every mail this app sends. It goes into X-SES-MESSAGE-TAGS when a configuration set is
 * configured, so future bounce/complaint events (SNS) can be told apart from other senders in the account.
 */
export const APP_EMAIL_TAG = { name: 'app', value: 'pawelperfect' } as const;

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
  /** Kind of mail, sent as a tag (letters, digits, `_` and `-` only). */
  kind: string;
  /** Present only for mail a recipient can unsubscribe from (never security or payment mail). */
  unsubscribe?: EmailUnsubscribe | null;
  /** Kept for callers (broadcast queue); SES has no idempotency key, so it is not sent anywhere. */
  idempotencyKey?: string;
  headers?: Record<string, string>;
  /** "system" (default, EMAIL_FROM) or "support" (EMAIL_SUPPORT_FROM, mail that comes out of support work). */
  sender?: 'system' | 'support';
};

export type { EmailSendError, EmailSendResult };

/** What a provider adapter receives: everything already rendered. */
export type PreparedEmail = {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  tags: { name: string; value: string }[];
  idempotencyKey?: string;
};

/**
 * Every mail is machine-generated: say so (RFC 3834) so auto-responders stay quiet, and give each
 * message a unique reference so mail clients never thread unrelated sends together.
 * List-Unsubscribe + List-Unsubscribe-Post (RFC 8058) only for mail with an unsubscribe target
 * (marketing/broadcast), never for account or system notifications.
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

export async function sendEmail(input: OutgoingEmail): Promise<EmailSendResult> {
  const from = input.sender === 'support' ? getEmailSupportFrom() : getEmailFrom();
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

  const prepared: PreparedEmail = {
    from,
    replyTo: getEmailReplyTo(),
    to: input.to,
    subject,
    html,
    text: htmlToPlainText(html),
    headers: buildEmailHeaders(input.unsubscribe, input.headers),
    tags: [APP_EMAIL_TAG, { name: 'kind', value: input.kind }],
    idempotencyKey: input.idempotencyKey,
  };

  return sendViaSes(prepared);
}
