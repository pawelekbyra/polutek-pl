/**
 * Own mail transport: hands a message to our own Postfix (the `pp-mail-lab` container) over SMTP on a private docker
 * network. It is a second, growing path next to the primary provider (Resend or Postmark), never the only one: any
 * failure here sends the same mail through the primary provider (sendEmail() in resend-email.transport.ts).
 * Runbook and rollout: docs/operations/MAIL-OWN-TRANSPORT.md.
 *
 * Routing is conservative by design: off unless EMAIL_OWN_SMTP_HOST is set; only the mail kinds listed in
 * EMAIL_OWN_KINDS; only a percentage of recipients (EMAIL_OWN_SHARE, decided by a hash of the address so the same
 * person always takes the same path); never mass mail (`stream: 'news'`).
 */
import { createHash, randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailSendError, EmailSendResult } from "../domain/email-provider";

type Env = Record<string, string | undefined>;

export type OwnMailConfig = {
  host: string;
  port: number;
  /** Envelope sender (Return-Path). Postfix signs with the lab DKIM key and SPF covers its subdomain. */
  envelopeFrom: string;
  kinds: ReadonlySet<string>;
  /** 0..100, share of recipients that take the own path. */
  share: number;
};

export type OwnMailMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string;
  headers: Record<string, string>;
  kind: string;
  stream?: "news";
};

const DEFAULT_ENVELOPE_FROM = "lab@lab.pawelperfect.com";

/** null = own transport disabled (no host configured). */
export function getOwnMailConfig(env: Env = process.env): OwnMailConfig | null {
  const host = env.EMAIL_OWN_SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number.parseInt(env.EMAIL_OWN_SMTP_PORT ?? "", 10);
  const share = Number.parseFloat(env.EMAIL_OWN_SHARE ?? "");
  return {
    host,
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 25,
    envelopeFrom: env.EMAIL_OWN_ENVELOPE_FROM?.trim() || DEFAULT_ENVELOPE_FROM,
    kinds: new Set((env.EMAIL_OWN_KINDS ?? "").split(",").map((k) => k.trim()).filter(Boolean)),
    share: Number.isFinite(share) ? Math.min(100, Math.max(0, share)) : 0,
  };
}

/** Stable bucket 0..99 per recipient, so a given address always takes the same path for a given share. */
export function recipientBucket(address: string): number {
  const digest = createHash("sha256").update(address.trim().toLowerCase()).digest();
  return digest.readUInt32BE(0) % 100;
}

/** True when this message should try the own path first. Mass mail never does. */
export function shouldUseOwnTransport(message: Pick<OwnMailMessage, "to" | "kind" | "stream">, config: OwnMailConfig | null): boolean {
  if (!config || config.share <= 0 || message.stream === "news") return false;
  if (!config.kinds.has(message.kind)) return false;
  return recipientBucket(message.to) < config.share;
}

let cached: { key: string; transporter: Transporter } | null = null;

function getTransporter(config: OwnMailConfig): Transporter {
  const key = `${config.host}|${config.port}`;
  if (cached?.key === key) return cached.transporter;
  cached?.transporter.close();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // Private docker network, no credentials, no certificate to check: plain SMTP on purpose. Nothing leaves the host here.
    secure: false,
    ignoreTLS: true,
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 20_000,
  });
  cached = { key, transporter };
  return transporter;
}

/** Test helper: forget the cached transporter. */
export function resetOwnMailTransportForTests(): void {
  cached?.transporter.close();
  cached = null;
}

/** Postfix answers "250 2.0.0 Ok: queued as 4F3A1B2C3D"; that queue id is what the delivery log lines carry. */
export function extractQueueId(response: unknown): string | null {
  if (typeof response !== "string") return null;
  return /queued as ([A-Za-z0-9]+)/i.exec(response)?.[1] ?? null;
}

export function mapOwnMailError(error: unknown): EmailSendError {
  const e = (error && typeof error === "object" ? error : {}) as { code?: unknown; responseCode?: unknown; message?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  const smtp = typeof e.responseCode === "number" ? e.responseCode : null;
  const message = (typeof e.message === "string" ? e.message : String(error)).slice(0, 300);
  // Connection-level failures carry no status: the caller treats them as "own path unavailable".
  if (!smtp) return { name: code ? `own_smtp_${code.toLowerCase()}` : "own_smtp_failed", message, statusCode: null };
  return { name: "own_smtp_rejected", message, statusCode: smtp };
}

export async function sendViaOwnMail(message: OwnMailMessage, config: OwnMailConfig, transporter: Pick<Transporter, "sendMail"> = getTransporter(config)): Promise<EmailSendResult> {
  try {
    const info = await transporter.sendMail({
      from: message.from,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
      // The visible From stays our normal sender; the envelope sender is the lab subdomain whose SPF and DKIM we control.
      envelope: { from: config.envelopeFrom, to: [message.to] },
      // Our own Message-ID on the sending domain (nodemailer would use the envelope-less default).
      messageId: `<${randomUUID()}@pawelperfect.com>`,
    });
    return { ok: true, id: extractQueueId(info.response) ?? (typeof info.messageId === "string" ? info.messageId : null) };
  } catch (error) {
    return { ok: false, error: mapOwnMailError(error) };
  }
}
