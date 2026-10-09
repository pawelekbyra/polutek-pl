import { createHash } from "node:crypto";
import { logger } from "@/lib/logger";
import type { AppContext } from "../../shared/app-context";
import type { ResendWebhookInput } from "../domain/email.dto";
import { classifyBounce, parsePostfixLog, type PostfixDelivery } from "../domain/postfix-log";
import { APP_EMAIL_TAG } from "../infrastructure/resend-email.transport";
import { handleResendWebhook } from "./handle-resend-webhook.use-case";

export type OwnMailEventsSummary = {
  parsed: number;
  sent: number;
  deferred: number;
  /** Hard bounces of the address itself: handed to the suppression logic. */
  addressBounces: number;
  /** The receiving side refused us (reputation, policy, rate limit): never suppresses, raises an alert. */
  blocks: number;
  otherBounces: number;
  /** Events the handler could not process (the caller should retry the same log window). */
  errors: number;
  /** Distinct block reasons (DSN + short text, no addresses) for the alert. */
  blockReasons: string[];
};

/** Stable per delivery line and free of addresses (the idempotency lock stores this id). */
export function ownEventId(d: PostfixDelivery): string {
  const hash = createHash("sha256").update([d.at ?? "", d.queueId, d.to, d.status, d.dsn].join("|")).digest("hex").slice(0, 24);
  return `own:${hash}`;
}

export function toBounceEvent(d: PostfixDelivery): ResendWebhookInput {
  return {
    eventId: ownEventId(d),
    type: "email.bounced",
    created_at: d.at ?? undefined,
    data: { email_id: d.queueId, to: [d.to], tags: { [APP_EMAIL_TAG.name]: APP_EMAIL_TAG.value }, bounce: { type: "permanent", message: d.detail } },
  };
}

/**
 * Turns a window of the Postfix log into suppression and alerts. Safe to run on overlapping windows: every line has a
 * stable event id, and the idempotency lock makes a repeat a no-op. Only address-level hard bounces reach
 * handleResendWebhook (which suppresses the address); delivered/deferred are only counted.
 */
export async function processOwnMailEvents(ctx: AppContext, logText: string): Promise<OwnMailEventsSummary> {
  const summary: OwnMailEventsSummary = { parsed: 0, sent: 0, deferred: 0, addressBounces: 0, blocks: 0, otherBounces: 0, errors: 0, blockReasons: [] };
  const reasons = new Set<string>();

  for (const d of parsePostfixLog(logText)) {
    summary.parsed++;
    if (d.status === "sent") summary.sent++;
    else if (d.status === "deferred") summary.deferred++;
    else {
      const kind = classifyBounce(d.dsn, d.detail);
      if (kind === "block") {
        summary.blocks++;
        reasons.add(`${d.dsn} ${d.detail.replace(/<[^>]*>/g, "<addr>").replace(/\b[\w.+-]+@[\w.-]+\b/g, "<addr>").slice(0, 120)}`);
      } else if (kind === "other") summary.otherBounces++;
      else {
        summary.addressBounces++;
        const result = await handleResendWebhook(ctx, toBounceEvent(d));
        if (!result.ok) summary.errors++;
      }
    }
  }

  summary.blockReasons = [...reasons].slice(0, 10);
  if (summary.blocks > 0) logger.error("[own-mail] Receivers are blocking our own mail path", { blocks: summary.blocks, reasons: summary.blockReasons });
  return summary;
}
