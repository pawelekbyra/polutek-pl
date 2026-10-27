import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/constants";
import { buildContentUnsubscribeUrl, buildOneClickUnsubscribeUrl } from "@/lib/modules/subscriptions";
import {
  BROADCAST_BATCH_SIZE,
  BROADCAST_LEASE_MS,
  BROADCAST_RUN_BUDGET_MS,
  BROADCAST_SEND_INTERVAL_MS,
  BROADCAST_SEND_TIMEOUT_MS,
  classifySendFailure,
} from "../domain/broadcast-queue.policy";
import { renderBroadcastMessage } from "../domain/broadcast-message";
import type { EmailSendResult } from "../domain/email-provider";
import { prisma } from "@/lib/prisma";
import { BroadcastQueueRepository, type BroadcastQueueStore, type ClaimedBroadcast, type QueuedRecipient } from "../infrastructure/broadcast-queue.repository";
import { EMAIL_SENDER_NAME, sendEmail } from "../infrastructure/resend-email.transport";

export type BroadcastRunResult = {
  broadcastId: string | null;
  sent: number;
  skipped: number;
  failed: number;
  retried: number;
  /** Set when Resend said 429: the broadcast waits until then. */
  pausedUntil: string | null;
  finished: boolean;
  /** True when another run took the broadcast over (lease expired under a stalled send): this run stopped without finishing it. */
  leaseLost: boolean;
};

export type SendBroadcastMail = (broadcast: ClaimedBroadcast, recipient: QueuedRecipient, nickname: string | null) => Promise<EmailSendResult>;

export type BroadcastQueueDeps = {
  store: BroadcastQueueStore;
  send?: SendBroadcastMail;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  budgetMs?: number;
  sendTimeoutMs?: number;
};

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * One broadcast mail. The idempotency key makes a resend of the same recipient (a run that died
 * after Resend accepted the mail but before the database said so) a no-op at Resend for 24 h.
 */
export const sendBroadcastMail: SendBroadcastMail = async (broadcast, recipient, nickname) => {
  const userId = recipient.userId;
  const pageUrl = userId ? buildContentUnsubscribeUrl(userId, appUrl()) : null;
  const oneClickUrl = userId ? buildOneClickUnsubscribeUrl(userId, appUrl()) : null;
  if (!pageUrl || !oneClickUrl) {
    return { ok: false, error: { name: "unsubscribe_link_unavailable", message: "Unsubscribe link unavailable", statusCode: 400 } };
  }

  const message = renderBroadcastMessage(broadcast, {
    language: recipient.language === "en" ? "en" : "pl",
    nickname,
    email: recipient.email,
    appName: APP_NAME,
    brandName: EMAIL_SENDER_NAME,
    appUrl: appUrl(),
    unsubscribePageUrl: pageUrl,
  });

  return sendEmail({
    to: recipient.email,
    subject: message.subject,
    html: message.html,
    language: message.language,
    kind: "broadcast",
    stream: "news",
    unsubscribe: { oneClickUrl, footerHtml: message.footerHtml },
    idempotencyKey: `broadcast/${broadcast.id}/${recipient.id}`,
  });
};

/**
 * A send that hangs (provider not answering) must not hold the run past its lease: after the timeout the
 * recipient is treated like a network error and retried later. If the provider did accept the mail after all,
 * the idempotency key of the retry makes it a no-op there, and the recipient status is only ever written from PENDING.
 */
async function sendWithTimeout(send: SendBroadcastMail, timeoutMs: number, broadcast: ClaimedBroadcast, recipient: QueuedRecipient, nickname: string | null): Promise<EmailSendResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<EmailSendResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: { name: "send_timeout", message: "Send timed out" } }), timeoutMs);
  });
  try {
    return await Promise.race([send(broadcast, recipient, nickname), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * One run of the broadcast queue (called by /api/cron/send-broadcasts every minute). Takes one due
 * broadcast, sends to its pending recipients one by one at a safe pace until the time budget is
 * used, and hands the broadcast back. Every recipient is re-checked right before sending, so a
 * person who unsubscribed or bounced in the meantime is skipped. Safe to run twice at once (lease)
 * and after a crash (pending recipients stay pending, the lease runs out).
 */
export async function processBroadcastQueue(deps: BroadcastQueueDeps): Promise<BroadcastRunResult> {
  const { store } = deps;
  const send = deps.send ?? sendBroadcastMail;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const budgetMs = deps.budgetMs ?? BROADCAST_RUN_BUDGET_MS;
  const sendTimeoutMs = deps.sendTimeoutMs ?? BROADCAST_SEND_TIMEOUT_MS;
  const startedAt = now();
  const result: BroadcastRunResult = { broadcastId: null, sent: 0, skipped: 0, failed: 0, retried: 0, pausedUntil: null, finished: false, leaseLost: false };

  const broadcast = await store.claimNext(BROADCAST_LEASE_MS);
  if (!broadcast) return result;
  result.broadcastId = broadcast.id;

  const token = broadcast.leaseToken;
  let pauseUntil: Date | null = null;
  try {
    outer: while (now() - startedAt < budgetMs) {
      const batch = await store.loadDueRecipients(broadcast.id, BROADCAST_BATCH_SIZE);
      if (batch.length === 0) break;

      const eligible = await store.stillEligible(batch.flatMap((r) => (r.userId ? [r.userId] : [])));

      for (const recipient of batch) {
        if (now() - startedAt >= budgetMs) break outer;

        const current = recipient.userId ? eligible.get(recipient.userId) : undefined;
        if (!current) {
          await store.markSkipped(recipient.id, "NO_LONGER_ELIGIBLE");
          result.skipped++;
          continue;
        }

        // Renewed before every send: a long run keeps its lease, and a run that was too slow (the lease ran out and
        // another run owns the broadcast now) stops here instead of sending to the same people again.
        if (!(await store.renewLease(broadcast.id, token, BROADCAST_LEASE_MS))) {
          result.leaseLost = true;
          logger.warn(`[broadcast] lease of broadcast ${broadcast.id} lost; this run stops`);
          return result;
        }

        const attempt = recipient.attemptCount + 1;
        const outcome = await sendWithTimeout(send, sendTimeoutMs, broadcast, recipient, current.name);
        if (outcome.ok) {
          await store.markSent(recipient.id, outcome.id);
          result.sent++;
        } else {
          const verdict = classifySendFailure(outcome.error, attempt);
          if (verdict.kind === "pause") {
            pauseUntil = new Date(now() + verdict.delayMs);
            logger.warn(`[broadcast] Resend refused (${verdict.reason}); pausing broadcast ${broadcast.id}`);
            break outer;
          }
          if (verdict.kind === "retry") {
            await store.scheduleRetry(recipient.id, verdict.reason, attempt, new Date(now() + verdict.delayMs));
            result.retried++;
          } else {
            await store.markFailed(recipient.id, verdict.reason, attempt);
            result.failed++;
          }
        }
        await sleep(BROADCAST_SEND_INTERVAL_MS);
      }
    }

    if (!pauseUntil && !(await store.hasPending(broadcast.id))) {
      await store.finalize(broadcast.id, token);
      result.finished = true;
    } else {
      await store.release(broadcast.id, token, pauseUntil);
    }
  } catch (error) {
    // Hand the broadcast back at once; the next run continues where this one stopped.
    await store.release(broadcast.id, token, null).catch(() => undefined);
    throw error;
  }

  result.pausedUntil = pauseUntil ? pauseUntil.toISOString() : null;
  return result;
}

/** One queue run against the application database (what the send-broadcasts cron calls). */
export function runBroadcastQueue(): Promise<BroadcastRunResult> {
  return processBroadcastQueue({ store: new BroadcastQueueRepository(prisma) });
}
