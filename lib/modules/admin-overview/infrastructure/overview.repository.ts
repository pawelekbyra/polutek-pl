/**
 * Read-only queries behind the overview screens. Every query is bounded (time window or `take`) and
 * selects only the columns it shows. No writes, no third-party calls.
 */
import type { ReadDb } from "@/lib/modules/shared/db";
import { REVENUE_STATUSES } from "../domain/rules";
import type { Window } from "../domain/time";

export type RevenueRow = { createdAt: Date; amountMinor: number; refundedAmountMinor: number; currency: string };
export type EncodeJobRow = {
  id: string;
  videoId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  stage: string;
  progressPercent: number;
  attemptCount: number;
  maxAttempts: number;
  heartbeatAt: Date | null;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  video: { title: string };
};

export type ActivityRows = {
  payments: { id: string; createdAt: Date; amountMinor: number; currency: string; user: { name: string | null } | null }[];
  users: { id: string; createdAt: Date; name: string | null; onboardingPending: boolean }[];
  comments: { id: string; createdAt: Date; text: string; author: { name: string | null } | null; video: { title: string } | null }[];
  audit: { id: string; createdAt: Date; action: string; targetType: string | null; actorType: string | null }[];
  panel: { id: string; createdAt: Date; action: string; outcome: string; reason: string | null; country: string | null }[];
};

export interface OverviewRepository {
  revenue(w: Window): Promise<RevenueRow[]>;
  createdAt(model: "user" | "comment" | "report" | "view", w: Window): Promise<Date[]>;
  moderation(): Promise<{ pendingReports: number; oldestPendingReportAt: Date | null; heldComments: number }>;
  encodeJobs(since: Date): Promise<EncodeJobRow[]>;
  latestSuccessByVideo(videoIds: string[]): Promise<Map<string, Date>>;
  payments(now: Date, pendingOlderThan: Date): Promise<{ disputed: number; stalePending: number }>;
  stripeEvents(since: Date, stuckBefore: Date): Promise<{ failed: number; stuck: number; lastAt: Date | null }>;
  broadcasts(since: Date, now: Date): Promise<{
    failed: number;
    sending: number;
    pendingRecipients: number;
    scheduled: { id: string; subjectPl: string; scheduledAt: Date; recipientCount: number }[];
  }>;
  premieres(now: Date): Promise<{ id: string; title: string; slug: string; premiereAt: Date }[]>;
  activity(take: number): Promise<ActivityRows>;
  database(): Promise<{ sizeBytes: number | null; connections: number | null; maxConnections: number | null; latencyMs: number | null; version: string | null }>;
}

export class PrismaOverviewRepository implements OverviewRepository {
  constructor(private db: ReadDb) {}

  revenue(w: Window) {
    return this.db.payment.findMany({
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: w.from, lte: w.to } },
      select: { createdAt: true, amountMinor: true, refundedAmountMinor: true, currency: true },
    });
  }

  async createdAt(model: "user" | "comment" | "report" | "view", w: Window): Promise<Date[]> {
    const range = { gte: w.from, lte: w.to };
    if (model === "user") {
      const rows = await this.db.user.findMany({ where: { createdAt: range, isDeleted: false }, select: { createdAt: true } });
      return rows.map((r) => r.createdAt);
    }
    if (model === "comment") {
      const rows = await this.db.comment.findMany({ where: { createdAt: range }, select: { createdAt: true } });
      return rows.map((r) => r.createdAt);
    }
    if (model === "report") {
      const rows = await this.db.commentReport.findMany({ where: { createdAt: range }, select: { createdAt: true } });
      return rows.map((r) => r.createdAt);
    }
    // A view = a playback session the site counted as a view (same rule as the public counters); admin previews excluded.
    const rows = await this.db.videoPlaybackSession.findMany({
      where: { startedAt: range, countedAsView: true, isAdminPreview: false },
      select: { startedAt: true },
    });
    return rows.map((r) => r.startedAt);
  }

  async moderation() {
    const [pendingReports, oldest, heldComments] = await Promise.all([
      this.db.commentReport.count({ where: { status: "PENDING" } }),
      this.db.commentReport.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      this.db.comment.count({ where: { status: "HELD_FOR_REVIEW" } }),
    ]);
    return { pendingReports, oldestPendingReportAt: oldest?.createdAt ?? null, heldComments };
  }

  encodeJobs(since: Date) {
    return this.db.videoEncodeJob.findMany({
      where: { OR: [{ status: { in: ["QUEUED", "RUNNING"] } }, { updatedAt: { gte: since } }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        videoId: true,
        status: true,
        stage: true,
        progressPercent: true,
        attemptCount: true,
        maxAttempts: true,
        heartbeatAt: true,
        failureCode: true,
        failureReason: true,
        createdAt: true,
        finishedAt: true,
        video: { select: { title: true } },
      },
    }) as Promise<EncodeJobRow[]>;
  }

  async latestSuccessByVideo(videoIds: string[]) {
    if (videoIds.length === 0) return new Map<string, Date>();
    const rows = await this.db.videoEncodeJob.groupBy({
      by: ["videoId"],
      where: { videoId: { in: videoIds }, status: "SUCCEEDED" },
      _max: { finishedAt: true },
    });
    const out = new Map<string, Date>();
    for (const r of rows) if (r._max.finishedAt) out.set(r.videoId, r._max.finishedAt);
    return out;
  }

  async payments(_now: Date, pendingOlderThan: Date) {
    const [disputed, stalePending] = await Promise.all([
      this.db.payment.count({ where: { status: "DISPUTED" } }),
      this.db.payment.count({ where: { status: "PENDING", createdAt: { lt: pendingOlderThan } } }),
    ]);
    return { disputed, stalePending };
  }

  async stripeEvents(since: Date, stuckBefore: Date) {
    const [failed, stuck, last] = await Promise.all([
      this.db.stripeEvent.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
      this.db.stripeEvent.count({ where: { status: "PROCESSING", createdAt: { lt: stuckBefore } } }),
      this.db.stripeEvent.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    return { failed, stuck, lastAt: last?.createdAt ?? null };
  }

  async broadcasts(since: Date, now: Date) {
    const [failed, sending, pendingRecipients, scheduled] = await Promise.all([
      this.db.broadcastEmail.count({ where: { status: { in: ["FAILED", "PARTIAL_FAILED"] }, updatedAt: { gte: since } } }),
      this.db.broadcastEmail.count({ where: { status: "SENDING" } }),
      this.db.broadcastEmailRecipient.count({ where: { status: "PENDING" } }),
      this.db.broadcastEmail.findMany({
        where: { status: { in: ["READY", "DRAFT"] }, scheduledAt: { gt: now } },
        orderBy: { scheduledAt: "asc" },
        take: 3,
        select: { id: true, subjectPl: true, scheduledAt: true, recipientCount: true },
      }),
    ]);
    return {
      failed,
      sending,
      pendingRecipients,
      scheduled: scheduled.filter((b): b is typeof b & { scheduledAt: Date } => b.scheduledAt !== null),
    };
  }

  async premieres(now: Date) {
    const rows = await this.db.video.findMany({
      where: { status: "PUBLISHED", premiereAt: { gt: now } },
      orderBy: { premiereAt: "asc" },
      take: 3,
      select: { id: true, title: true, slug: true, premiereAt: true },
    });
    return rows.filter((r): r is typeof r & { premiereAt: Date } => r.premiereAt !== null);
  }

  async activity(take: number): Promise<ActivityRows> {
    const [payments, users, comments, audit, panel] = await Promise.all([
      this.db.payment.findMany({
        where: { status: { in: [...REVENUE_STATUSES] } },
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, createdAt: true, amountMinor: true, currency: true, user: { select: { name: true } } },
      }),
      this.db.user.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, createdAt: true, name: true, onboardingPending: true },
      }),
      this.db.comment.findMany({
        where: { status: { in: ["VISIBLE", "HELD_FOR_REVIEW"] }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, createdAt: true, text: true, author: { select: { name: true } }, video: { select: { title: true } } },
      }),
      this.db.auditLog.findMany({
        where: { actorType: "admin" },
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, createdAt: true, action: true, targetType: true, actorType: true },
      }),
      this.db.adminAuthEvent.findMany({
        orderBy: { seq: "desc" },
        take,
        select: { id: true, createdAt: true, action: true, outcome: true, reason: true, country: true },
      }),
    ]);
    return { payments, users, comments, audit, panel };
  }

  async database() {
    const started = Date.now();
    try {
      const rows = await this.db.$queryRaw<{ size: bigint; conns: bigint; max: string; version: string }[]>`
        SELECT pg_database_size(current_database()) AS size,
               (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS conns,
               current_setting('max_connections') AS max,
               current_setting('server_version') AS version`;
      const r = rows[0];
      return {
        sizeBytes: r ? Number(r.size) : null,
        connections: r ? Number(r.conns) : null,
        maxConnections: r ? Number(r.max) : null,
        latencyMs: Date.now() - started,
        version: r?.version ?? null,
      };
    } catch {
      return { sizeBytes: null, connections: null, maxConnections: null, latencyMs: null, version: null };
    }
  }
}
