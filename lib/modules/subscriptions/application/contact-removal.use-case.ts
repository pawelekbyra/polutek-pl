import { AppContext } from "@/lib/modules/shared/app-context";
import { DbClient, WriteTx } from "@/lib/modules/shared/db";
import { logger } from "@/lib/logger";
import { maskEmailForLog } from "../domain/email-address";
import { ResendAudienceGateway } from "../infrastructure/resend-audience.gateway";

const HOUR_MS = 60 * 60 * 1000;
/** Retry backoff after a failed removal: 1 h, 2 h, 4 h ... capped at one day. */
const MAX_BACKOFF_MS = 24 * HOUR_MS;
const BATCH_LIMIT = 50;

export function contactRemovalBackoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, HOUR_MS * 2 ** Math.max(0, attempts - 1));
}

/**
 * Queues the removal of these addresses from the Resend Audience. Runs inside the account-deletion
 * transaction, so the deletion never depends on Resend being reachable; the queue is worked off
 * right after the deletion and then daily by /api/cron/retention.
 */
export async function enqueueContactRemovals(tx: WriteTx, emails: string[], now: Date): Promise<void> {
  for (const email of [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]) {
    await tx.resendContactRemoval.upsert({
      where: { email },
      create: { email, nextAttemptAt: now },
      update: { nextAttemptAt: now },
    });
  }
}

export interface ContactRemovalRunResult {
  removed: number;
  failed: number;
  skipped: number;
}

/**
 * Removes queued contacts that are due. A contact counts as removed when Resend confirms it (or it
 * does not exist there). When the address meanwhile belongs to a live account that opted in again,
 * the queued removal is dropped without touching Resend. Failures stay queued with a backoff.
 */
export async function processContactRemovals(
  ctx: AppContext,
  options: { emails?: string[]; gateway?: ResendAudienceGateway } = {},
): Promise<ContactRemovalRunResult> {
  const db = ctx.prisma as DbClient;
  const now = ctx.now();
  const gateway = options.gateway ?? new ResendAudienceGateway();
  const due = await db.resendContactRemoval.findMany({
    where: {
      nextAttemptAt: { lte: now },
      ...(options.emails ? { email: { in: options.emails.map((e) => e.trim().toLowerCase()) } } : {}),
    },
    orderBy: { nextAttemptAt: "asc" },
    take: BATCH_LIMIT,
  });

  const result: ContactRemovalRunResult = { removed: 0, failed: 0, skipped: 0 };
  for (const row of due) {
    const optedInAgain = await db.emailPreference.findFirst({
      where: { email: row.email, marketingEmails: true, userId: { not: null } },
      select: { id: true },
    });
    if (optedInAgain) {
      await db.resendContactRemoval.deleteMany({ where: { id: row.id } });
      result.skipped += 1;
      continue;
    }

    const status = await gateway.removeContact(row.email);
    if (status === "FAILED") {
      const attempts = row.attempts + 1;
      await db.resendContactRemoval.updateMany({
        where: { id: row.id },
        data: { attempts, lastError: "RESEND_REMOVE_FAILED", nextAttemptAt: new Date(now.getTime() + contactRemovalBackoffMs(attempts)) },
      });
      logger.warn("[contact-removal] Resend contact removal failed, will retry", { email: maskEmailForLog(row.email), attempts });
      result.failed += 1;
      continue;
    }
    // SYNCED, or NOT_CONFIGURED (no audience configured, so no contact was ever created there).
    await db.resendContactRemoval.deleteMany({ where: { id: row.id } });
    result.removed += 1;
  }
  return result;
}
