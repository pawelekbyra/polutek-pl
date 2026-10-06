import type { EmailSendError } from "./email-provider";

/**
 * Pacing and retry rules of the broadcast queue (no I/O).
 *
 * Resend allows 10 API requests per second per team by default and answers 429 above it, also for a
 * spent daily or monthly quota (https://resend.com/docs/api-reference/rate-limit). Broadcasts share
 * that budget with verification and reset mails, so they go one at a time with a pause, well under
 * the limit, and stop for a while as soon as Resend says 429. The SES adapter maps its SMTP replies
 * (454 throttling / daily quota, 535 auth) to the same names and status codes, so this one policy
 * serves both providers (SES sandbox: 1 mail per second, which the 250 ms pause plus the 429 pause respect).
 */

/** Pause between two broadcast mails: at most 4 per second. */
export const BROADCAST_SEND_INTERVAL_MS = 250;
/** One cron run sends for at most this long, then hands over to the next run (timer: every minute). */
export const BROADCAST_RUN_BUDGET_MS = 50_000;
/** A run holds the broadcast this long; if the process dies the next run takes over after it. */
export const BROADCAST_LEASE_MS = 5 * 60_000;
/** Recipients loaded per round trip. */
export const BROADCAST_BATCH_SIZE = 25;
/** A recipient whose send keeps failing with a temporary error is given up after this many tries. */
export const BROADCAST_MAX_ATTEMPTS = 5;

export type SendFailureVerdict =
  /** Too many requests right now: stop this run, keep the recipient, try again shortly. */
  | { kind: "pause"; delayMs: number; reason: string }
  /** Temporary problem with this one send: try the recipient again later. */
  | { kind: "retry"; delayMs: number; reason: string }
  /** Will never work (invalid address, rejected content): mark the recipient FAILED. */
  | { kind: "fail"; reason: string };

const QUOTA_ERRORS = new Set(["daily_quota_exceeded", "monthly_quota_exceeded"]);
/** Account-wide problems (bad credentials): every recipient would fail the same way, so wait instead of failing them. */
/** SMTP 5xx replies that are final for this recipient (SES rejections); a 5xx status must not be mistaken for "try again". */
const PERMANENT_ERRORS = new Set(["message_rejected", "message_rejected_not_verified", "message_too_large"]);
const ACCOUNT_ERRORS = new Set(["smtp_auth_failed", "smtp_credentials_missing"]);

export function classifySendFailure(error: EmailSendError, attemptCount: number): SendFailureVerdict {
  const name = error.name ?? "";
  const reason = (name || error.message || "unknown_error").slice(0, 200);

  if (QUOTA_ERRORS.has(name)) {
    // The daily quota resets within a day; check again in an hour.
    return { kind: "pause", delayMs: 60 * 60_000, reason };
  }
  if (ACCOUNT_ERRORS.has(name)) {
    return { kind: "pause", delayMs: 60 * 60_000, reason };
  }
  if (error.statusCode === 429 || name === "rate_limit_exceeded") {
    return { kind: "pause", delayMs: 60_000, reason };
  }

  if (PERMANENT_ERRORS.has(name)) return { kind: "fail", reason };

  const temporary =
    error.statusCode == null || // network error, timeout: no HTTP status at all
    error.statusCode >= 500 ||
    name === "application_error" ||
    name === "internal_server_error" ||
    name === "concurrent_idempotent_requests";
  if (temporary) {
    if (attemptCount >= BROADCAST_MAX_ATTEMPTS) return { kind: "fail", reason };
    // 1, 2, 4, 8 minutes.
    return { kind: "retry", delayMs: 60_000 * 2 ** Math.max(0, attemptCount - 1), reason };
  }
  return { kind: "fail", reason };
}
