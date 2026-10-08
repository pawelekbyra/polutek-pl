/**
 * Postmark as an alternative provider of sendEmail() (docs/operations/EMAIL_POSTMARK.md). Plain HTTPS to the
 * Email API (POST /email), no SDK and no new dependency. Selected by EMAIL_PROVIDER=postmark; Resend stays the
 * default and the fallback. Postmark keeps transactional and broadcast mail in separate message streams with
 * separate reputation, which is exactly the split this app makes (`stream: 'news'` = broadcast).
 */
import type { EmailSendError, EmailSendResult } from "../domain/email-provider";

const ENDPOINT = "https://api.postmarkapp.com/email";
const TIMEOUT_MS = 10_000;

type Env = Record<string, string | undefined>;

export type PostmarkMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string;
  headers: Record<string, string>;
  /** One tag per message in Postmark: the kind of mail. */
  tag: string;
  /** String values only (max 80 chars each); the webhook reads `app` to tell our mail from foreign mail. */
  metadata: Record<string, string>;
  /** 'news' = broadcast stream, otherwise the default transactional stream. */
  stream?: "news";
};

/** Headers Postmark manages itself or that only make sense for another provider. */
const DROPPED_HEADERS = new Set(["feedback-id"]);

export function postmarkToken(env: Env = process.env): string | null {
  const token = env.POSTMARK_SERVER_TOKEN?.trim();
  return token ? token : null;
}

/** Message stream ids: Postmark's default transactional stream is "outbound"; broadcast is a stream we create ("broadcast"). */
export function postmarkStream(stream: "news" | undefined, env: Env = process.env): string {
  if (stream === "news") return env.POSTMARK_STREAM_NEWS?.trim() || "broadcast";
  return env.POSTMARK_STREAM_TX?.trim() || "outbound";
}

export function buildPostmarkPayload(m: PostmarkMessage, env: Env = process.env) {
  return {
    From: m.from,
    To: m.to,
    Subject: m.subject,
    HtmlBody: m.html,
    TextBody: m.text,
    ReplyTo: m.replyTo,
    Headers: Object.entries(m.headers)
      .filter(([name]) => !DROPPED_HEADERS.has(name.toLowerCase()))
      .map(([Name, Value]) => ({ Name, Value })),
    Tag: m.tag.slice(0, 1000),
    Metadata: Object.fromEntries(Object.entries(m.metadata).map(([k, v]) => [k, String(v).slice(0, 80)])),
    MessageStream: postmarkStream(m.stream, env),
    // No tracking: no pixel and no rewritten links (same stance as the Resend setup).
    TrackOpens: false,
    TrackLinks: "None",
  };
}

/** Postmark error codes that mean "this account/token cannot send right now": the caller may fall back to another provider. */
export const POSTMARK_UNAVAILABLE_CODES = new Set([10, 412]);

export function isProviderUnavailable(error: EmailSendError): boolean {
  if (error.statusCode == null || error.statusCode >= 500) return true;
  const code = /PostmarkError(\d+)/.exec(error.name ?? "")?.[1];
  return code !== undefined && POSTMARK_UNAVAILABLE_CODES.has(Number(code));
}

export async function sendViaPostmark(m: PostmarkMessage, fetcher: typeof fetch = fetch, env: Env = process.env): Promise<EmailSendResult> {
  const token = postmarkToken(env);
  if (!token) return { ok: false, error: { name: "PostmarkNotConfigured", message: "POSTMARK_SERVER_TOKEN is missing", statusCode: null } };
  try {
    const res = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": token },
      body: JSON.stringify(buildPostmarkPayload(m, env)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as { ErrorCode?: number; Message?: string; MessageID?: string } | null;
    if (res.ok && body && body.ErrorCode === 0) return { ok: true, id: typeof body.MessageID === "string" ? body.MessageID : null };
    return {
      ok: false,
      error: { name: `PostmarkError${body?.ErrorCode ?? res.status}`, message: body?.Message ?? `Postmark HTTP ${res.status}`, statusCode: res.status },
    };
  } catch (error) {
    return { ok: false, error: { name: error instanceof Error ? error.name : "PostmarkRequestFailed", message: error instanceof Error ? error.message : String(error), statusCode: null } };
  }
}
