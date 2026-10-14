import type { ChannelStatus, ContentReportStatus, Prisma, ReportTargetType } from "@prisma/client";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { recordAuditEvent } from "@/lib/modules/audit";
import { authorize } from "@/lib/modules/authz";
import { defaultLimitsFor } from "@/lib/platform-limits";
import { isMainChannelId, resolveMainChannelId } from "./main-channel.service";

/**
 * Platform staff operations on creator channels (admin panel, stage 5). Every function authorizes first
 * (CLAUDE.md 4.23); every write is one transaction with a ModerationDecision (append-only) and an audit row
 * carrying the channelId. Staff never act "as" the creator here.
 */
export type StaffChannelRow = {
  id: string;
  name: string;
  slug: string;
  handle: string | null;
  status: ChannelStatus;
  /** The platform's main channel (the `main_channel_id` setting): protected from suspension and deletion. */
  isMain: boolean;
  isVerified: boolean;
  ownerEmail: string | null;
  videoCount: number;
  subscribersCount: number;
  openReports: number;
  createdAt: Date;
};

export type StaffChannelList = { items: StaffChannelRow[]; total: number; page: number; pageSize: number; totalPages: number };

export async function listChannelsForStaff(
  ctx: AppContext,
  input: { q?: string; status?: ChannelStatus; page: number; pageSize: number },
): Promise<UseCaseResult<StaffChannelList, AppError>> {
  const denied = await authorize(ctx, "platform.view_all_channels");
  if (denied) return fail(denied);
  const q = input.q?.trim().slice(0, 80);
  const where: Prisma.CreatorWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { handle: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const page = Math.max(1, input.page);
  const [total, rows] = await Promise.all([
    ctx.prisma.creator.count({ where }),
    ctx.prisma.creator.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true, name: true, slug: true, handle: true, status: true, isVerified: true,
        subscribersCount: true, createdAt: true,
        user: { select: { email: true } },
        _count: { select: { videos: true } },
      },
    }),
  ]);
  const open = await ctx.prisma.contentReport.groupBy({
    by: ["channelId"],
    where: { status: "PENDING", channelId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  });
  const openBy = new Map(open.map((o) => [o.channelId, o._count._all]));
  const mainId = await resolveMainChannelId(ctx.prisma);
  const items: StaffChannelRow[] = rows.map((r) => ({
    id: r.id, name: r.name, slug: r.slug, handle: r.handle, status: r.status, isMain: r.id === mainId,
    isVerified: r.isVerified, ownerEmail: r.user?.email ?? null, videoCount: r._count.videos,
    subscribersCount: r.subscribersCount, openReports: openBy.get(r.id) ?? 0, createdAt: r.createdAt,
  }));
  return ok({ items, total, page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) });
}

export type StaffChannelDetail = StaffChannelRow & {
  statusReason: string | null;
  statusChangedAt: Date | null;
  bio: string | null;
  deletedAt: Date | null;
  members: { userId: string; email: string | null; role: string }[];
  quota: { trustLevel: number; maxStorageBytes: number; maxUploadBytes: number; maxVideoSeconds: number; maxUploadsPerDay: number; maxQueuedJobs: number; usedStorageBytes: number };
  strikes: { id: string; reason: string; policy: string; issuedAt: Date; expiresAt: Date | null; revokedAt: Date | null }[];
  decisions: { id: string; action: string; reasonCode: string; reasonPublic: string; createdAt: Date }[];
};

export async function getChannelForStaff(ctx: AppContext, channelId: string): Promise<UseCaseResult<StaffChannelDetail, AppError>> {
  const denied = await authorize(ctx, "platform.view_all_channels");
  if (denied) return fail(denied);
  const c = await ctx.prisma.creator.findUnique({
    where: { id: channelId },
    select: {
      id: true, name: true, slug: true, handle: true, status: true, statusReason: true, statusChangedAt: true, bio: true,
      isVerified: true, subscribersCount: true, createdAt: true, deletedAt: true,
      user: { select: { email: true } },
      members: { select: { userId: true, role: true, user: { select: { email: true } } } },
      quota: true,
      strikes: { orderBy: { issuedAt: "desc" }, take: 20, select: { id: true, reason: true, policy: true, issuedAt: true, expiresAt: true, revokedAt: true } },
      _count: { select: { videos: true } },
    },
  });
  if (!c) return fail(new AppError("Nie znaleziono kanału.", 404, "CHANNEL_NOT_FOUND"));
  const [openReports, decisions] = await Promise.all([
    ctx.prisma.contentReport.count({ where: { channelId, status: "PENDING" } }),
    ctx.prisma.moderationDecision.findMany({
      where: { channelId }, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, action: true, reasonCode: true, reasonPublic: true, createdAt: true },
    }),
  ]);
  const isMain = await isMainChannelId(ctx.prisma, c.id);
  const level = c.quota?.trustLevel ?? 0;
  const d = defaultLimitsFor(level);
  const quota = {
    trustLevel: level,
    maxStorageBytes: c.quota ? Number(c.quota.maxStorageBytes) : d.maxStorageBytes,
    maxUploadBytes: c.quota ? Number(c.quota.maxUploadBytes) : d.maxUploadBytes,
    maxVideoSeconds: c.quota?.maxVideoSeconds ?? d.maxVideoSeconds,
    maxUploadsPerDay: c.quota?.maxUploadsPerDay ?? d.maxUploadsPerDay,
    maxQueuedJobs: c.quota?.maxQueuedJobs ?? d.maxQueuedJobs,
    usedStorageBytes: c.quota ? Number(c.quota.usedStorageBytes) : 0,
  };
  return ok({
    id: c.id, name: c.name, slug: c.slug, handle: c.handle, status: c.status, isMain,
    isVerified: c.isVerified, ownerEmail: c.user?.email ?? null, videoCount: c._count.videos,
    subscribersCount: c.subscribersCount, openReports, createdAt: c.createdAt,
    statusReason: c.statusReason, statusChangedAt: c.statusChangedAt, bio: c.bio, deletedAt: c.deletedAt,
    members: c.members.map((m) => ({ userId: m.userId, email: m.user?.email ?? null, role: m.role })),
    quota, strikes: c.strikes, decisions,
  });
}

const SETTABLE: readonly ChannelStatus[] = ["ACTIVE", "LIMITED", "SUSPENDED", "BANNED"];

export async function setChannelStatus(
  ctx: AppContext,
  input: { channelId: string; status: ChannelStatus; reason: string; reasonPublic?: string },
): Promise<UseCaseResult<{ status: ChannelStatus }, AppError>> {
  const heavy = input.status === "SUSPENDED" || input.status === "BANNED";
  const denied = await authorize(ctx, heavy ? "platform.suspend_channel" : "platform.moderate_channel");
  if (denied) return fail(denied);
  if (!SETTABLE.includes(input.status)) return fail(new AppError("Nieprawidłowy status kanału.", 400, "INVALID_STATUS"));
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) return fail(new AppError("Podaj powód (5-500 znaków).", 400, "REASON_REQUIRED"));
  const channel = await ctx.prisma.creator.findUnique({ where: { id: input.channelId }, select: { id: true, status: true } });
  if (!channel || channel.status === "DELETED") return fail(new AppError("Nie znaleziono kanału.", 404, "CHANNEL_NOT_FOUND"));
  if (heavy && (await isMainChannelId(ctx.prisma, channel.id))) return fail(new AppError("Kanału głównego nie można zawiesić ani zablokować.", 409, "PRIMARY_PROTECTED"));
  if (channel.status === input.status) return fail(new AppError("Kanał ma już ten status.", 409, "STATUS_UNCHANGED"));
  const adminId = ctx.actor.type === "admin" ? ctx.actor.userId : null;
  const now = ctx.now();
  try {
    await ctx.db.writeTransaction(async (tx) => {
      const { count } = await tx.creator.updateMany({
        where: { id: channel.id, status: channel.status },
        data: {
          status: input.status,
          statusReason: reason,
          statusChangedAt: now,
          statusChangedById: adminId,
        },
      });
      if (count === 0) throw new AppError("Status kanału zmienił się w międzyczasie. Odśwież stronę.", 409, "STATUS_CONFLICT");
      await tx.moderationDecision.create({
        data: {
          targetType: "CHANNEL", targetId: channel.id, channelId: channel.id,
          action: `CHANNEL_${input.status}`, reasonCode: "STAFF_DECISION",
          reasonPublic: input.reasonPublic?.trim().slice(0, 500) || reason, reasonInternal: reason, actorAdminId: adminId,
        },
      });
      await recordAuditEvent(ctx, {
        action: "CHANNEL_STATUS_CHANGED", targetType: "Creator", targetId: channel.id, channelId: channel.id,
        metadata: { before: { status: channel.status }, after: { status: input.status }, reason },
      }, tx);
    });
  } catch (error) {
    if (error instanceof AppError) return fail(error);
    throw error;
  }
  return ok({ status: input.status });
}

export async function issueChannelStrike(
  ctx: AppContext,
  input: { channelId: string; policy: string; reason: string; expiresInDays?: number },
): Promise<UseCaseResult<{ id: string }, AppError>> {
  const denied = await authorize(ctx, "platform.moderate_channel");
  if (denied) return fail(denied);
  const reason = input.reason.trim();
  const policy = input.policy.trim();
  if (reason.length < 5 || reason.length > 500 || policy.length < 2 || policy.length > 80) {
    return fail(new AppError("Podaj zasadę i powód ostrzeżenia.", 400, "REASON_REQUIRED"));
  }
  if (ctx.actor.type !== "admin") return fail(new AppError("Tylko administrator platformy.", 403, "FORBIDDEN"));
  const channel = await ctx.prisma.creator.findUnique({ where: { id: input.channelId }, select: { id: true } });
  if (!channel) return fail(new AppError("Nie znaleziono kanału.", 404, "CHANNEL_NOT_FOUND"));
  const adminId = ctx.actor.userId;
  const days = Math.min(Math.max(Math.trunc(input.expiresInDays ?? 90), 1), 365);
  const expiresAt = new Date(ctx.now().getTime() + days * 86_400_000);
  const strike = await ctx.db.writeTransaction(async (tx) => {
    const row = await tx.channelStrike.create({ data: { channelId: channel.id, reason, policy, issuedByAdminId: adminId, expiresAt }, select: { id: true } });
    await recordAuditEvent(ctx, {
      action: "CHANNEL_STRIKE_ISSUED", targetType: "Creator", targetId: channel.id, channelId: channel.id,
      metadata: { strikeId: row.id, policy, reason, expiresAt: expiresAt.toISOString() },
    }, tx);
    return row;
  });
  return ok({ id: strike.id });
}

export async function revokeChannelStrike(ctx: AppContext, input: { strikeId: string; reason: string }): Promise<UseCaseResult<undefined, AppError>> {
  const denied = await authorize(ctx, "platform.moderate_channel");
  if (denied) return fail(denied);
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) return fail(new AppError("Podaj powód (5-500 znaków).", 400, "REASON_REQUIRED"));
  const strike = await ctx.prisma.channelStrike.findUnique({ where: { id: input.strikeId }, select: { id: true, channelId: true, revokedAt: true } });
  if (!strike) return fail(new AppError("Nie znaleziono ostrzeżenia.", 404, "STRIKE_NOT_FOUND"));
  if (strike.revokedAt) return fail(new AppError("Ostrzeżenie jest już cofnięte.", 409, "STRIKE_REVOKED"));
  await ctx.db.writeTransaction(async (tx) => {
    await tx.channelStrike.update({ where: { id: strike.id }, data: { revokedAt: ctx.now() } });
    await recordAuditEvent(ctx, {
      action: "CHANNEL_STRIKE_REVOKED", targetType: "Creator", targetId: strike.channelId, channelId: strike.channelId,
      metadata: { strikeId: strike.id, reason },
    }, tx);
  });
  return ok(undefined);
}

export async function setChannelTrustLevel(
  ctx: AppContext,
  input: { channelId: string; trustLevel: number },
): Promise<UseCaseResult<{ trustLevel: number }, AppError>> {
  const denied = await authorize(ctx, "platform.manage_channel");
  if (denied) return fail(denied);
  const level = Math.trunc(input.trustLevel);
  if (!Number.isFinite(level) || level < 0 || level > 2) return fail(new AppError("Poziom zaufania: 0-2.", 400, "INVALID_TRUST_LEVEL"));
  const channel = await ctx.prisma.creator.findUnique({ where: { id: input.channelId }, select: { id: true, quota: { select: { trustLevel: true } } } });
  if (!channel) return fail(new AppError("Nie znaleziono kanału.", 404, "CHANNEL_NOT_FOUND"));
  const l = defaultLimitsFor(level);
  const data = {
    trustLevel: level, maxStorageBytes: BigInt(l.maxStorageBytes), maxUploadBytes: BigInt(l.maxUploadBytes),
    maxVideoSeconds: l.maxVideoSeconds, maxUploadsPerDay: l.maxUploadsPerDay, maxQueuedJobs: l.maxQueuedJobs,
  };
  await ctx.db.writeTransaction(async (tx) => {
    await tx.channelQuota.upsert({ where: { channelId: channel.id }, create: { channelId: channel.id, ...data }, update: data });
    await recordAuditEvent(ctx, {
      action: "CHANNEL_TRUST_LEVEL_CHANGED", targetType: "Creator", targetId: channel.id, channelId: channel.id,
      metadata: { before: { trustLevel: channel.quota?.trustLevel ?? 0 }, after: { trustLevel: level } },
    }, tx);
  });
  return ok({ trustLevel: level });
}

export type StaffReportRow = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  channelId: string | null;
  channelName: string | null;
  targetLabel: string | null;
  reason: string;
  note: string | null;
  status: ContentReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
};

export async function listContentReports(
  ctx: AppContext,
  input: { status?: ContentReportStatus; channelId?: string; page: number; pageSize: number },
): Promise<UseCaseResult<{ items: StaffReportRow[]; total: number; page: number; pageSize: number; totalPages: number }, AppError>> {
  const denied = await authorize(ctx, "platform.moderate_channel");
  if (denied) return fail(denied);
  const where: Prisma.ContentReportWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.channelId ? { channelId: input.channelId } : {}),
  };
  const page = Math.max(1, input.page);
  const [total, rows] = await Promise.all([
    ctx.prisma.contentReport.count({ where }),
    ctx.prisma.contentReport.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  const channelIds = [...new Set(rows.map((r) => r.channelId).filter((v): v is string => !!v))];
  const videoIds = rows.filter((r) => r.targetType === "VIDEO").map((r) => r.targetId);
  const [channels, videos] = await Promise.all([
    ctx.prisma.creator.findMany({ where: { id: { in: channelIds } }, select: { id: true, name: true } }),
    ctx.prisma.video.findMany({ where: { id: { in: videoIds } }, select: { id: true, title: true } }),
  ]);
  const cName = new Map(channels.map((c) => [c.id, c.name]));
  const vTitle = new Map(videos.map((v) => [v.id, v.title]));
  const items: StaffReportRow[] = rows.map((r) => ({
    id: r.id, targetType: r.targetType, targetId: r.targetId, channelId: r.channelId,
    channelName: r.channelId ? cName.get(r.channelId) ?? null : null,
    targetLabel: r.targetType === "VIDEO" ? vTitle.get(r.targetId) ?? null : null,
    reason: r.reason, note: r.note, status: r.status, createdAt: r.createdAt, resolvedAt: r.resolvedAt,
  }));
  return ok({ items, total, page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) });
}

export async function resolveContentReport(
  ctx: AppContext,
  input: { reportId: string; outcome: "DISMISSED" | "ACTION_TAKEN"; reasonPublic: string; reasonInternal?: string; removeVideo?: boolean },
): Promise<UseCaseResult<undefined, AppError>> {
  const denied = await authorize(ctx, "platform.moderate_channel");
  if (denied) return fail(denied);
  const reasonPublic = input.reasonPublic.trim();
  if (reasonPublic.length < 3 || reasonPublic.length > 500) return fail(new AppError("Podaj uzasadnienie decyzji (3-500 znaków).", 400, "REASON_REQUIRED"));
  const report = await ctx.prisma.contentReport.findUnique({ where: { id: input.reportId } });
  if (!report) return fail(new AppError("Nie znaleziono zgłoszenia.", 404, "REPORT_NOT_FOUND"));
  if (report.status !== "PENDING") return fail(new AppError("To zgłoszenie jest już rozstrzygnięte.", 409, "REPORT_RESOLVED"));
  const adminId = ctx.actor.type === "admin" ? ctx.actor.userId : null;
  const now = ctx.now();
  try {
    await ctx.db.writeTransaction(async (tx) => {
      const { count } = await tx.contentReport.updateMany({
        where: { id: report.id, status: "PENDING" },
        data: { status: input.outcome, resolvedAt: now, resolvedByAdminId: adminId },
      });
      if (count === 0) throw new AppError("To zgłoszenie jest już rozstrzygnięte.", 409, "REPORT_RESOLVED");
      const takedown = input.outcome === "ACTION_TAKEN" && input.removeVideo === true && report.targetType === "VIDEO";
      if (takedown) await tx.video.update({ where: { id: report.targetId }, data: { moderationStatus: "REMOVED" } });
      const decision = await tx.moderationDecision.create({
        data: {
          targetType: report.targetType, targetId: report.targetId, channelId: report.channelId,
          action: takedown ? "VIDEO_REMOVED" : input.outcome === "DISMISSED" ? "REPORT_DISMISSED" : "REPORT_ACTION_TAKEN",
          reasonCode: report.reason, reasonPublic, reasonInternal: input.reasonInternal?.trim().slice(0, 500) || null,
          actorAdminId: adminId, reportId: report.id,
        },
        select: { id: true },
      });
      await tx.contentReport.update({ where: { id: report.id }, data: { decisionId: decision.id } });
      await recordAuditEvent(ctx, {
        action: "CONTENT_REPORT_RESOLVED", targetType: "ContentReport", targetId: report.id, channelId: report.channelId ?? undefined,
        metadata: { outcome: input.outcome, decisionId: decision.id, takedown },
      }, tx);
    });
  } catch (error) {
    if (error instanceof AppError) return fail(error);
    throw error;
  }
  return ok(undefined);
}

export type StaffVideoRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  moderationStatus: string;
  tier: string;
  views: number;
  createdAt: Date;
};

/** The channel's latest videos for the staff moderation screen (every status, newest first). */
export async function listChannelVideosForStaff(ctx: AppContext, channelId: string, limit = 50): Promise<UseCaseResult<StaffVideoRow[], AppError>> {
  const denied = await authorize(ctx, "platform.view_all_channels");
  if (denied) return fail(denied);
  const rows = await ctx.prisma.video.findMany({
    where: { creatorId: channelId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    select: { id: true, slug: true, title: true, status: true, moderationStatus: true, tier: true, views: true, createdAt: true },
  });
  return ok(rows.map((r) => ({ ...r, status: String(r.status), moderationStatus: String(r.moderationStatus), tier: String(r.tier) })));
}

const VIDEO_MODERATION = ["VISIBLE", "LIMITED", "AGE_RESTRICTED", "REMOVED"] as const;
export type VideoModerationValue = (typeof VIDEO_MODERATION)[number];

/**
 * Staff decision on one video outside a report (policy takedown, age restriction, restoring). One transaction with
 * the statement of reasons (ModerationDecision) and the audit row; staff never edit a creator's film otherwise.
 */
export async function setVideoModerationStatus(
  ctx: AppContext,
  input: { videoId: string; status: VideoModerationValue; reason: string; reasonPublic?: string },
): Promise<UseCaseResult<undefined, AppError>> {
  const denied = await authorize(ctx, "platform.moderate_channel");
  if (denied) return fail(denied);
  if (!VIDEO_MODERATION.includes(input.status)) return fail(new AppError("Nieprawidłowy status moderacji.", 400, "INVALID_STATUS"));
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) return fail(new AppError("Podaj powód (5-500 znaków).", 400, "REASON_REQUIRED"));
  const video = await ctx.prisma.video.findUnique({ where: { id: input.videoId }, select: { id: true, creatorId: true, moderationStatus: true } });
  if (!video) return fail(new AppError("Nie znaleziono filmu.", 404, "VIDEO_NOT_FOUND"));
  if (video.moderationStatus === input.status) return fail(new AppError("Film ma już ten status.", 409, "STATUS_UNCHANGED"));
  const adminId = ctx.actor.type === "admin" ? ctx.actor.userId : null;
  await ctx.db.writeTransaction(async (tx) => {
    await tx.video.update({ where: { id: video.id }, data: { moderationStatus: input.status } });
    await tx.moderationDecision.create({
      data: {
        targetType: "VIDEO", targetId: video.id, channelId: video.creatorId,
        action: `VIDEO_${input.status}`, reasonCode: "STAFF_DECISION",
        reasonPublic: input.reasonPublic?.trim().slice(0, 500) || reason, reasonInternal: reason, actorAdminId: adminId,
      },
    });
    await recordAuditEvent(ctx, {
      action: "VIDEO_MODERATION_CHANGED", targetType: "Video", targetId: video.id, channelId: video.creatorId,
      metadata: { before: { moderationStatus: video.moderationStatus }, after: { moderationStatus: input.status }, reason },
    }, tx);
  });
  return ok(undefined);
}
