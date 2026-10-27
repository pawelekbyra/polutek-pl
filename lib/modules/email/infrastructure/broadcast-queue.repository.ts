import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { BroadcastCounts } from "../domain/email.dto";
import { findEligibleRecipients } from "./broadcast-audience";

export type ClaimedBroadcast = {
  id: string;
  subjectPl: string;
  htmlPl: string;
  subjectEn: string;
  htmlEn: string;
  /** Random owner token of this run's lease (`BroadcastEmail.lockedBy`); every later write of the run needs it. */
  leaseToken: string;
};

export type QueuedRecipient = {
  id: string;
  userId: string | null;
  email: string;
  language: string;
  attemptCount: number;
};

/** Everything the broadcast sender needs from the database (a fake implements it in tests). */
export interface BroadcastQueueStore {
  /** Takes the oldest due broadcast and leases it to this run (owner token in `leaseToken`); null when there is nothing to send. */
  claimNext(leaseMs: number): Promise<ClaimedBroadcast | null>;
  /** PENDING recipients whose retry time has come, oldest first. */
  loadDueRecipients(broadcastId: string, limit: number): Promise<QueuedRecipient[]>;
  /** For each user id that may still receive the broadcast: the nickname to greet them with. */
  stillEligible(userIds: string[]): Promise<Map<string, { name: string | null }>>;
  markSent(recipientId: string, providerEmailId: string | null): Promise<void>;
  markSkipped(recipientId: string, reason: string): Promise<void>;
  markFailed(recipientId: string, reason: string, attemptCount: number): Promise<void>;
  scheduleRetry(recipientId: string, reason: string, attemptCount: number, at: Date): Promise<void>;
  /** Any PENDING recipient left (including ones waiting for a retry)? */
  hasPending(broadcastId: string): Promise<boolean>;
  /** Extends the lease while this run still owns it. false = another run took the broadcast over: stop and write nothing more. */
  renewLease(broadcastId: string, leaseToken: string, leaseMs: number): Promise<boolean>;
  /** Hands the broadcast back (lease cleared) if this run still owns it; `nextRunAt` delays the next run after a 429. */
  release(broadcastId: string, leaseToken: string, nextRunAt: Date | null): Promise<void>;
  /** All recipients done: SENT, or PARTIAL_FAILED when some failed. Only for the lease owner; leaves a CANCELLED broadcast alone. */
  finalize(broadcastId: string, leaseToken: string): Promise<void>;
}

/** Recipient statuses grouped the way the admin reads them. */
export function summarizeRecipientStatuses(rows: Array<{ status: string; _count: number }>): BroadcastCounts {
  const counts: BroadcastCounts = { pending: 0, sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    if (row.status === "PENDING") counts.pending += row._count;
    else if (["SENT", "DELIVERED", "OPENED", "CLICKED"].includes(row.status)) counts.sent += row._count;
    else if (["FAILED", "BOUNCED", "COMPLAINED"].includes(row.status)) counts.failed += row._count;
    else counts.skipped += row._count;
  }
  return counts;
}

export class BroadcastQueueRepository implements BroadcastQueueStore {
  constructor(private readonly db: PrismaClient) {}

  /**
   * `FOR UPDATE SKIP LOCKED` + a lease: two overlapping runs never take the same broadcast, and a
   * broadcast whose run died (restart, crash) is taken over once the lease runs out. Times come from
   * the database clock in UTC, like the video encode queue.
   */
  async claimNext(leaseMs: number): Promise<ClaimedBroadcast | null> {
    const leaseSeconds = Math.ceil(leaseMs / 1000);
    const leaseToken = randomUUID();
    const rows = await this.db.$queryRaw<Array<Omit<ClaimedBroadcast, "leaseToken">>>`
      UPDATE "BroadcastEmail" AS b
      SET "status" = 'SENDING',
          "lockedUntil" = (now() AT TIME ZONE 'UTC') + make_interval(secs => ${leaseSeconds}::double precision),
          "lockedBy" = ${leaseToken},
          "nextRunAt" = NULL,
          "updatedAt" = (now() AT TIME ZONE 'UTC')
      WHERE b."id" = (
        SELECT c."id" FROM "BroadcastEmail" AS c
        WHERE c."status" IN ('READY', 'SENDING')
          AND (c."lockedUntil" IS NULL OR c."lockedUntil" < (now() AT TIME ZONE 'UTC'))
          AND (c."nextRunAt" IS NULL OR c."nextRunAt" <= (now() AT TIME ZONE 'UTC'))
        ORDER BY c."createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING b."id", b."subjectPl", b."htmlPl", b."subjectEn", b."htmlEn"
    `;
    return rows[0] ? { ...rows[0], leaseToken } : null;
  }

  async renewLease(broadcastId: string, leaseToken: string, leaseMs: number) {
    const changed = await this.db.$executeRaw`
      UPDATE "BroadcastEmail"
      SET "lockedUntil" = (now() AT TIME ZONE 'UTC') + make_interval(secs => ${Math.ceil(leaseMs / 1000)}::double precision),
          "updatedAt" = (now() AT TIME ZONE 'UTC')
      WHERE "id" = ${broadcastId} AND "status" = 'SENDING' AND "lockedBy" = ${leaseToken}
    `;
    return changed === 1;
  }

  loadDueRecipients(broadcastId: string, limit: number): Promise<QueuedRecipient[]> {
    return this.db.broadcastEmailRecipient.findMany({
      where: {
        broadcastEmailId: broadcastId,
        status: "PENDING",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, userId: true, email: true, language: true, attemptCount: true },
    });
  }

  async stillEligible(userIds: string[]) {
    const eligible = await findEligibleRecipients(this.db, userIds);
    return new Map(eligible.map((r) => [r.userId, { name: r.name }]));
  }

  async markSent(recipientId: string, providerEmailId: string | null) {
    await this.db.broadcastEmailRecipient.updateMany({
      where: { id: recipientId, status: "PENDING" },
      data: { status: "SENT", resendEmailId: providerEmailId, sentAt: new Date(), error: null, attemptCount: { increment: 1 } },
    });
  }

  async markSkipped(recipientId: string, reason: string) {
    await this.db.broadcastEmailRecipient.updateMany({
      where: { id: recipientId, status: "PENDING" },
      data: { status: "SKIPPED", error: reason },
    });
  }

  async markFailed(recipientId: string, reason: string, attemptCount: number) {
    await this.db.broadcastEmailRecipient.updateMany({
      where: { id: recipientId, status: "PENDING" },
      data: { status: "FAILED", error: reason, attemptCount },
    });
  }

  async scheduleRetry(recipientId: string, reason: string, attemptCount: number, at: Date) {
    await this.db.broadcastEmailRecipient.updateMany({
      where: { id: recipientId, status: "PENDING" },
      data: { error: reason, attemptCount, nextAttemptAt: at },
    });
  }

  async hasPending(broadcastId: string) {
    const count = await this.db.broadcastEmailRecipient.count({ where: { broadcastEmailId: broadcastId, status: "PENDING" } });
    return count > 0;
  }

  async release(broadcastId: string, leaseToken: string, nextRunAt: Date | null) {
    await this.db.broadcastEmail.updateMany({
      where: { id: broadcastId, status: "SENDING", lockedBy: leaseToken },
      data: { lockedUntil: null, lockedBy: null, nextRunAt },
    });
  }

  async finalize(broadcastId: string, leaseToken: string) {
    const grouped = await this.db.broadcastEmailRecipient.groupBy({
      by: ["status"],
      where: { broadcastEmailId: broadcastId },
      _count: true,
    });
    const counts = summarizeRecipientStatuses(grouped.map((g) => ({ status: g.status, _count: g._count })));
    await this.db.broadcastEmail.updateMany({
      where: { id: broadcastId, status: "SENDING", lockedBy: leaseToken },
      data: {
        status: counts.failed > 0 ? (counts.sent > 0 ? "PARTIAL_FAILED" : "FAILED") : "SENT",
        sentAt: new Date(),
        sentCount: counts.sent,
        errorCount: counts.failed,
        lockedUntil: null,
        lockedBy: null,
        nextRunAt: null,
      },
    });
  }
}
