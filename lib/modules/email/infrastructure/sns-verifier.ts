import { createVerify, X509Certificate } from "node:crypto";

/**
 * Cryptographic verification of Amazon SNS HTTPS messages, as AWS documents it
 * (https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html):
 *  - the string to sign is built from a fixed, per-type list of fields ("Name\nValue\n"),
 *  - SignatureVersion 1 = RSA-SHA1, 2 = RSA-SHA256, signature is base64,
 *  - the certificate comes from SigningCertURL, which must be https on sns.<region>.amazonaws.com.
 * Fail closed: anything that is not provably a message of OUR topic is rejected, nothing is acted on.
 */

export type SnsMessage = {
  Type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  Token?: string;
  SubscribeURL?: string;
};

export type SnsRejection =
  | "not_configured"
  | "invalid_json"
  | "invalid_shape"
  | "unknown_type"
  | "topic_not_allowed"
  | "cert_url_not_allowed"
  | "timestamp_invalid"
  | "unsupported_signature_version"
  | "cert_fetch_failed"
  | "cert_invalid"
  | "signature_mismatch";

export type SnsVerification = { ok: true; message: SnsMessage } | { ok: false; reason: SnsRejection };

export type SnsVerifyOptions = {
  /** Allowed TopicArn values (SES_SNS_TOPIC_ARN). Empty = fail closed. */
  allowedTopicArns: string[];
  /** Regions whose sns.<region>.amazonaws.com may host the signing certificate. */
  allowedRegions: string[];
  /** Replaceable in tests. Must return the PEM text of the certificate. */
  fetchCertificate?: (url: string) => Promise<string>;
  now?: () => number;
};

const MAX_MESSAGE_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 15 * 60 * 1000;
const CERT_TTL_MS = 60 * 60 * 1000;
const CERT_FETCH_TIMEOUT_MS = 5000;
const CERT_MAX_BYTES = 16 * 1024;
const REGION = /^[a-z]{2}(-[a-z]+)+-\d$/;

const certCache = new Map<string, { pem: string; at: number }>();

export function resetSnsCertificateCacheForTests(): void {
  certCache.clear();
}

const FIELDS: Record<SnsMessage["Type"], string[]> = {
  Notification: ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"],
  SubscriptionConfirmation: ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"],
  UnsubscribeConfirmation: ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"],
};

/** The canonical string AWS signs. `Subject` is included only when the message has one. */
export function buildStringToSign(message: Record<string, unknown>, type: SnsMessage["Type"]): string {
  let out = "";
  for (const field of FIELDS[type]) {
    const value = message[field];
    if (value === undefined || value === null) {
      if (field === "Subject") continue;
      throw new Error(`missing ${field}`);
    }
    out += `${field}\n${String(value)}\n`;
  }
  return out;
}

/** https, host exactly sns.<allowed region>.amazonaws.com, no port/credentials/query, SimpleNotificationService-<id>.pem. */
export function isAllowedSnsUrl(raw: unknown, allowedRegions: string[], kind: "cert" | "subscribe"): boolean {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password || url.hash) return false;
  const regions = allowedRegions.filter((r) => REGION.test(r));
  if (!regions.some((region) => url.hostname === `sns.${region}.amazonaws.com`)) return false;
  if (kind === "cert") return /^\/SimpleNotificationService-[A-Za-z0-9]+\.pem$/.test(url.pathname) && url.search === "";
  return url.pathname === "/" && url.searchParams.get("Action") === "ConfirmSubscription";
}

async function defaultFetchCertificate(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CERT_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "error", cache: "no-store" });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const text = await response.text();
    if (text.length > CERT_MAX_BYTES) throw new Error("certificate too large");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function loadCertificate(url: string, options: SnsVerifyOptions, now: number): Promise<string | null> {
  const cached = certCache.get(url);
  if (cached && now - cached.at < CERT_TTL_MS) return cached.pem;
  try {
    const pem = await (options.fetchCertificate ?? defaultFetchCertificate)(url);
    const cert = new X509Certificate(pem);
    if (now < new Date(cert.validFrom).getTime() || now > new Date(cert.validTo).getTime()) return null;
    certCache.set(url, { pem, at: now });
    return pem;
  } catch {
    return null;
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function verifySnsMessage(rawBody: string, options: SnsVerifyOptions): Promise<SnsVerification> {
  const allowed = options.allowedTopicArns.map((a) => a.trim()).filter(Boolean);
  if (allowed.length === 0 || options.allowedRegions.length === 0) return { ok: false, reason: "not_configured" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "invalid_shape" };
  const m = parsed as Record<string, unknown>;

  const type = m.Type;
  if (type !== "Notification" && type !== "SubscriptionConfirmation" && type !== "UnsubscribeConfirmation") {
    return { ok: false, reason: "unknown_type" };
  }
  for (const field of ["MessageId", "TopicArn", "Message", "Timestamp", "SignatureVersion", "Signature", "SigningCertURL"]) {
    if (!isString(m[field])) return { ok: false, reason: "invalid_shape" };
  }
  if (type !== "Notification" && (!isString(m.Token) || !isString(m.SubscribeURL))) return { ok: false, reason: "invalid_shape" };

  if (!allowed.includes(m.TopicArn as string)) return { ok: false, reason: "topic_not_allowed" };
  if (!isAllowedSnsUrl(m.SigningCertURL, options.allowedRegions, "cert")) return { ok: false, reason: "cert_url_not_allowed" };

  const now = (options.now ?? Date.now)();
  const sentAt = Date.parse(m.Timestamp as string);
  if (!Number.isFinite(sentAt) || now - sentAt > MAX_MESSAGE_AGE_MS || sentAt - now > MAX_FUTURE_SKEW_MS) {
    return { ok: false, reason: "timestamp_invalid" };
  }

  const algorithm = m.SignatureVersion === "1" ? "RSA-SHA1" : m.SignatureVersion === "2" ? "RSA-SHA256" : null;
  if (!algorithm) return { ok: false, reason: "unsupported_signature_version" };

  const pem = await loadCertificate(m.SigningCertURL as string, options, now);
  if (!pem) return { ok: false, reason: "cert_fetch_failed" };

  let valid = false;
  try {
    const verifier = createVerify(algorithm);
    verifier.update(buildStringToSign(m, type), "utf8");
    valid = verifier.verify(pem, m.Signature as string, "base64");
  } catch {
    return { ok: false, reason: "signature_mismatch" };
  }
  return valid ? { ok: true, message: m as unknown as SnsMessage } : { ok: false, reason: "signature_mismatch" };
}
