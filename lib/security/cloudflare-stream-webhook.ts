import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

export type CloudflareStreamWebhookVerificationResult =
  | { ok: true }
  | { ok: false; reason: 'missing_secret' | 'missing_signature' | 'malformed_signature' | 'timestamp_out_of_tolerance' | 'invalid_signature' };

interface VerifyCloudflareStreamWebhookOptions {
  secret?: string;
  signatureHeader: string | null;
  rawBody: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}

const SIGNATURE_HEX_LENGTH = 64;
const HEX_SIGNATURE_PATTERN = /^[0-9a-f]+$/i;
const DECIMAL_TIMESTAMP_PATTERN = /^\d+$/;

export function verifyCloudflareStreamWebhookSignature({
  secret,
  signatureHeader,
  rawBody,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
}: VerifyCloudflareStreamWebhookOptions): CloudflareStreamWebhookVerificationResult {
  if (!secret) {
    return { ok: false, reason: 'missing_secret' };
  }

  if (!signatureHeader) {
    return { ok: false, reason: 'missing_signature' };
  }

  const parsed = parseWebhookSignatureHeader(signatureHeader);
  if (!parsed.ok) {
    return { ok: false, reason: 'malformed_signature' };
  }

  if (Math.abs(nowSeconds - parsed.time) > toleranceSeconds) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' };
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(`${parsed.time}.${rawBody}`, 'utf8')
    .digest('hex');

  const received = Buffer.from(parsed.sig1.toLowerCase(), 'hex');
  const expected = Buffer.from(expectedSignature, 'hex');

  if (received.length !== expected.length) {
    return { ok: false, reason: 'invalid_signature' };
  }

  if (!timingSafeEqual(received, expected)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  return { ok: true };
}

function parseWebhookSignatureHeader(signatureHeader: string):
  | { ok: true; time: number; sig1: string }
  | { ok: false } {
  const values = new Map<string, string>();

  for (const rawSegment of signatureHeader.split(',')) {
    const segment = rawSegment.trim();
    const separatorIndex = segment.indexOf('=');

    if (!segment || separatorIndex <= 0 || separatorIndex !== segment.lastIndexOf('=')) {
      return { ok: false };
    }

    const key = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();

    if (!key || !value) {
      return { ok: false };
    }

    const existing = values.get(key);
    if (existing !== undefined) {
      if (existing !== value) {
        return { ok: false };
      }
      continue;
    }

    values.set(key, value);
  }

  const timeValue = values.get('time');
  const sig1 = values.get('sig1');

  if (!timeValue || !sig1) {
    return { ok: false };
  }

  if (!DECIMAL_TIMESTAMP_PATTERN.test(timeValue)) {
    return { ok: false };
  }

  if (sig1.length !== SIGNATURE_HEX_LENGTH || !HEX_SIGNATURE_PATTERN.test(sig1)) {
    return { ok: false };
  }

  const time = Number(timeValue);
  if (!Number.isSafeInteger(time)) {
    return { ok: false };
  }

  return { ok: true, time, sig1 };
}
