import type { AppealStatus, ChannelStatus, Prisma } from "@prisma/client";
import type { AppContext } from "@/lib/modules/shared/app-context";
import type { WriteTx } from "@/lib/modules/shared/db";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { recordAuditEvent } from "@/lib/modules/audit";
import { authorize } from "@/lib/modules/authz";
import {
  APPEAL_STATUS_LABEL,
  appealDeadline,
  checkAppealText,
  describeDecisionAction,
  isAppealWindowOpen,
  isDecisionVisibleToCreator,
} from "../domain/moderation-appeal.policy";
import { notifyChannelOwnerOfDecision } from "../infrastructure/moderation-notice";

/**
 * Statement of reasons and appeals (DSA art. 17 and 20).
 *
 * Creator side: the owner (or a manager) of a channel sees the moderation decisions about the channel and its videos
 * and may appeal each one once, within six months. Staff side: the appeal queue; an upheld appeal reverses the effect
 * of the decision, a rejected one only records the reasons. Neither ever edits the original decision (database
 * trigger): the outcome is a NEW ModerationDecision referenced from `ModerationAppeal.outcomeDecisionId`.
 *
 * The creator-side functions authorize against the channel's roles WITHOUT its lifecycle status: a suspended or banned
 * channel is exactly the one whose owner must still be able to read the reasons and appeal (CLAUDE.md 4.23).
 */

// ---------------------------------------------------------------------------------------------------------------
// Creator side
// ---------------------------------------------------------------------------------------------------------------

export type CreatorDecisionRow = {
  id: string;
  createdAt: Date;
  /** Machine action (e.g. VIDEO_REMOVED); the label below is what the creator reads. */
  action: string;
  actionLabel: string;
  targetType: string;
  targetLabel: string | null;
  /** The public statement of reasons. `reasonInternal` is never part of this row. */
  reasonPublic: string;
  appealable: boolean;
  /** Why it cannot be appealed right now (window closed, appeal exists, ...), or null. */
  appealBlockedReason: string | null;
  appealDeadline: Date;
  appeal: {
    id: string;
    status: AppealStatus;
    statusLabel: string;
    createdAt: Date;
    resolvedAt: Date | null;
    /** Staff's public reasons for the outcome. */
    outcomeReasonPublic: string | null;
  } | null;
};

const MAX_DECISIONS = 100;

/** Authorizes the creator-side actions: owner or manager of the channel, whatever the channel status. */
async function authorizeChannelOwnerSide(ctx: AppContext, channelId: string): Promise<{ error: AppError } | { channel: { id: string; name: string } }> {
  if (ctx.actor.type === "guest") return { error: new AppError("Zaloguj się, aby zobaczyć decyzje.", 401, "UNAUTHENTICATED") };
  const channel = await ctx.prisma.creator.findUnique({
    where: { id: channelId },
    select: {
      id: true, name: true, userId: true,
      members: ctx.actor.type === "user" ? { where: { userId: ctx.actor.userId }, select: { userId: true, role: true } } : false,
    },
  });
  if (!channel) return { error: new AppError("Nie znaleziono kanału.", 404, "CHANNEL_NOT_FOUND") };
  // No `status` in the resource: the decision is made by the member's role only (see the file comment).
  const denied = await authorize(ctx, "channel.update", {
    channel: { id: channel.id, ownerUserId: channel.userId, members: channel.members },
  });
  if (denied) return { error: denied.statusCode === 401 ? denied : new AppError("Nie znaleziono kanału.", 404, "CHANNEL_NOT_FOUND") };
  return { channel: { id: channel.id, name: channel.name } };
}

export async function listDecisionsForCreator(
  ctx: AppContext,
  input: { channelId: string },
): Promise<UseCaseResult<{ items: CreatorDecisionRow[] }, AppError>> {
  const scope = await authorizeChannelOwnerSide(ctx, input.channelId);
  if ("error" in scope) return fail(scope.error);
  const now = ctx.now();

  const rows = await ctx.prisma.moderationDecision.findMany({
    where: { channelId: scope.channel.id, action: { notIn: ["REPORT_DISMISSED", "APPEAL_UPHELD", "APPEAL_REJECTED"] } },
    orderBy: { createdAt: "desc" },
    take: MAX_DECISIONS,
    // An explicit whitelist: `reasonInternal`, the acting admin and the report never leave this function.
    select: {
      id: true, createdAt: true, action: true, targetType: true, targetId: true, reasonPublic: true,
      appeals: { select: { id: true, status: true, createdAt: true, resolvedAt: true, outcomeDecisionId: true }, orderBy: { createdAt: "desc" } },
    },
  });
  const visible = rows.filter((r) => isDecisionVisibleToCreator(r.action));

  const videoIds = [...new Set(visible.filter((r) => r.targetType === "VIDEO").map((r) => r.targetId))];
  const outcomeIds = visible.flatMap((r) => r.appeals.map((a) => a.outcomeDecisionId).filter((v): v is string => !!v));
  const [videos, outcomes] = await Promise.all([
    videoIds.length ? ctx.prisma.video.findMany({ where: { id: { in: videoIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
    outcomeIds.length ? ctx.prisma.moderationDecision.findMany({ where: { id: { in: outcomeIds } }, select: { id: true, reasonPublic: true } }) : Promise.resolve([]),
  ]);
  const title = new Map(videos.map((v) => [v.id, v.title]));
  const outcomeText = new Map(outcomes.map((o) => [o.id, o.reasonPublic]));

  const items: CreatorDecisionRow[] = visible.map((r) => {
    const latest = r.appeals[0] ?? null;
    const deadline = appealDeadline(r.createdAt);
    let blocked: string | null = null;
    if (latest?.status === "PENDING") blocked = "Odwołanie czeka na rozpatrzenie.";
    else if (latest) blocked = "To odwołanie zostało już rozpatrzone.";
    else if (!isAppealWindowOpen(r.createdAt, now)) blocked = "Minął termin na odwołanie (6 miesięcy).";
    return {
      id: r.id,
      createdAt: r.createdAt,
      action: r.action,
      actionLabel: describeDecisionAction(r.action),
      targetType: r.targetType,
      targetLabel: r.targetType === "VIDEO" ? title.get(r.targetId) ?? null : r.targetType === "CHANNEL" ? scope.channel.name : null,
      reasonPublic: r.reasonPublic,
      appealable: blocked === null,
      appealBlockedReason: blocked,
      appealDeadline: deadline,
      appeal: latest
        ? {
            id: latest.id,
            status: latest.status,
            statusLabel: APPEAL_STATUS_LABEL[latest.status] ?? latest.status,
            createdAt: latest.createdAt,
            resolvedAt: latest.resolvedAt,
            outcomeReasonPublic: latest.outcomeDecisionId ? outcomeText.get(latest.outcomeDecisionId) ?? null : null,
          }
        : null,
    };
  });
  return ok({ items });
}

export async function createModerationAppeal(
  ctx: AppContext,
  input: { decisionId: string; text: string },
): Promise<UseCaseResult<{ id: string }, AppError>> {
  if (ctx.actor.type !== "user") return fail(new AppError("Zaloguj się, aby się odwołać.", 401, "UNAUTHENTICATED"));
  const userId = ctx.actor.userId;
  const decision = await ctx.prisma.moderationDecision.findUnique({
    where: { id: input.decisionId },
    select: { id: true, channelId: true, action: true, createdAt: true },
  });
  const notFound = new AppError("Nie znaleziono decyzji.", 404, "DECISION_NOT_FOUND");
  if (!decision || !decision.channelId) return fail(notFound);
  // Authorization first: a stranger learns nothing about the decision (same 404 as for a missing one).
  const scope = await authorizeChannelOwnerSide(ctx, decision.channelId);
  if ("error" in scope) return fail(scope.error.statusCode === 401 ? scope.error : notFound);

  if (!isDecisionVisibleToCreator(decision.action)) {
    return fail(new AppError("Tej decyzji nie można zaskarżyć.", 409, "NOT_APPEALABLE"));
  }
  if (!isAppealWindowOpen(decision.createdAt, ctx.now())) {
    return fail(new AppError("Minął termin na odwołanie (6 miesięcy od decyzji).", 409, "APPEAL_WINDOW_CLOSED"));
  }
  const checked = checkAppealText(input.text);
  if (!checked.ok) return fail(new AppError(checked.message, 400, "INVALID_TEXT"));

  const created = await ctx.db.writeTransaction(async (tx: WriteTx) => {
    // Two quick submissions must not both pass the check below (there is no unique index on a pending appeal).
    const raw = tx as unknown as { $executeRaw?: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> };
    if (typeof raw.$executeRaw === "function") await raw.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"appeal:" + decision.id}))`;
    const existing = await tx.moderationAppeal.findFirst({ where: { decisionId: decision.id }, select: { status: true } });
    if (existing) {
      return existing.status === "PENDING"
        ? new AppError("To odwołanie już czeka na rozpatrzenie.", 409, "APPEAL_PENDING")
        : new AppError("To odwołanie zostało już rozpatrzone.", 409, "APPEAL_RESOLVED");
    }
    const row = await tx.moderationAppeal.create({
      data: { decisionId: decision.id, userId, channelId: decision.channelId, text: checked.text },
      select: { id: true },
    });
    await recordAuditEvent(ctx, {
      action: "MODERATION_APPEAL_CREATED", targetType: "ModerationDecision", targetId: decision.id, channelId: decision.channelId ?? undefined,
      metadata: { appealId: row.id, decisionAction: decision.action, length: checked.text.length },
    }, tx);
    return row;
  });
  if (created instanceof AppError) return fail(created);
  return ok({ id: created.id });
}

// ---------------------------------------------------------------------------------------------------------------
// Staff side
// ---------------------------------------------------------------------------------------------------------------

export type StaffAppealRow = {
  id: string;
  status: AppealStatus;
  text: string;
  createdAt: Date;
  resolvedAt: Date | null;
  channelId: string | null;
  channelName: string | null;
  ownerEmail: string | null;
  appellantEmail: string | null;
  decision: {
    id: string;
    action: string;
    actionLabel: string;
    targetType: string;
    targetId: string;
    targetLabel: string | null;
    reasonCode: string;
    reasonPublic: string;
    reasonInternal: string | null;
    createdAt: Date;
  };
  outcome: { id: string; reasonPublic: string; createdAt: Date } | null;
};

export async function listAppealsForStaff(
  ctx: AppContext,
  input: { status?: AppealStatus; channelId?: string; page: number; pageSize: number },
): Promise<UseCaseResult<{ items: StaffAppealRow[]; total: number; page: number; pageSize: number; totalPages: number }, AppError>> {
  const denied = await authorize(ctx, "platform.moderate_channel");
  if (denied) return fail(denied);
  const where: Prisma.ModerationAppealWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.channelId ? { channelId: input.channelId } : {}),
  };
  const page = Math.max(1, input.page);
  const [total, rows] = await Promise.all([
    ctx.prisma.moderationAppeal.count({ where }),
    ctx.prisma.moderationAppeal.findMany({
      where,
      orderBy: input.status === "PENDING" ? { createdAt: "asc" } : { createdAt: "desc" },
      skip: (page - 1) * input.pageSize,
      take: input.pageSize,
      include: { decision: true },
    }),
  ]);
  const channelIds = [...new Set(rows.map((r) => r.channelId).filter((v): v is string => !!v))];
  const videoIds = rows.filter((r) => r.decision.targetType === "VIDEO").map((r) => r.decision.targetId);
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const outcomeIds = rows.map((r) => r.outcomeDecisionId).filter((v): v is string => !!v);
  const [channels, videos, users, outcomes] = await Promise.all([
    channelIds.length ? ctx.prisma.creator.findMany({ where: { id: { in: channelIds } }, select: { id: true, name: true, user: { select: { email: true } } } }) : Promise.resolve([]),
    videoIds.length ? ctx.prisma.video.findMany({ where: { id: { in: videoIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
    userIds.length ? ctx.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }) : Promise.resolve([]),
    outcomeIds.length ? ctx.prisma.moderationDecision.findMany({ where: { id: { in: outcomeIds } }, select: { id: true, reasonPublic: true, createdAt: true } }) : Promise.resolve([]),
  ]);
  const channelBy = new Map(channels.map((c) => [c.id, c]));
  const titleBy = new Map(videos.map((v) => [v.id, v.title]));
  const emailBy = new Map(users.map((u) => [u.id, u.email]));
  const outcomeBy = new Map(outcomes.map((o) => [o.id, o]));

  const items: StaffAppealRow[] = rows.map((r) => {
    const d = r.decision;
    const channel = r.channelId ? channelBy.get(r.channelId) : undefined;
    const outcome = r.outcomeDecisionId ? outcomeBy.get(r.outcomeDecisionId) : undefined;
    return {
      id: r.id, status: r.status, text: r.text, createdAt: r.createdAt, resolvedAt: r.resolvedAt,
      channelId: r.channelId, channelName: channel?.name ?? null, ownerEmail: channel?.user?.email ?? null,
      appellantEmail: emailBy.get(r.userId) ?? null,
      decision: {
        id: d.id, action: d.action, actionLabel: describeDecisionAction(d.action), targetType: d.targetType, targetId: d.targetId,
        targetLabel: d.targetType === "VIDEO" ? titleBy.get(d.targetId) ?? null : d.targetType === "CHANNEL" ? channel?.name ?? null : null,
        reasonCode: d.reasonCode, reasonPublic: d.reasonPublic, reasonInternal: d.reasonInternal, createdAt: d.createdAt,
      },
      outcome: outcome ? { id: outcome.id, reasonPublic: outcome.reasonPublic, createdAt: outcome.createdAt } : null,
    };
  });
  return ok({ items, total, page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) });
}

const CHANNEL_STATUSES: readonly ChannelStatus[] = ["PENDING_REVIEW", "ACTIVE", "LIMITED", "SUSPENDED", "BANNED"];
const RESTORABLE_CHANNEL: readonly string[] = ["ACTIVE", "LIMITED", "SUSPENDED", "BANNED"];
const VIDEO_STATES: readonly string[] = ["VISIBLE", "LIMITED", "AGE_RESTRICTED", "REMOVED"];

type Reverted = { reverted: boolean; note: string };

/** The audit row an action wrote for this decision (its `before` and ids), or null for decisions from before it existed. */
async function auditFor(tx: WriteTx, decisionId: string, actions: string[]) {
  const row = await tx.auditLog.findFirst({
    where: { action: { in: actions }, metadata: { path: ["decisionId"], equals: decisionId } },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });
  return (row?.metadata ?? null) as { before?: { status?: string; moderationStatus?: string }; strikeId?: string } | null;
}

/**
 * Reverses the effect of the decision inside the caller's transaction: a channel returns to the status it had before,
 * a video to its previous moderation status, a warning is revoked. The effect is reversed only while it is still in
 * force (a later decision may have changed the state again; then nothing is touched and the note says so).
 */
async function revertDecisionEffect(
  ctx: AppContext,
  tx: WriteTx,
  decision: { id: string; action: string; targetType: string; targetId: string; channelId: string | null },
  adminId: string | null,
): Promise<Reverted> {
  const { action } = decision;
  if (decision.targetType === "CHANNEL" && action.startsWith("CHANNEL_") && RESTORABLE_CHANNEL.includes(action.slice(8))) {
    const decided = action.slice(8) as ChannelStatus;
    const channel = await tx.creator.findUnique({ where: { id: decision.targetId }, select: { id: true, status: true } });
    if (!channel) return { reverted: false, note: "Kanał już nie istnieje." };
    if (channel.status !== decided) return { reverted: false, note: `Status kanału zmienił się od tamtej decyzji (teraz: ${channel.status}); nic nie cofnięto.` };
    const meta = await auditFor(tx, decision.id, ["CHANNEL_STATUS_CHANGED"]);
    const prev = meta?.before?.status as ChannelStatus | undefined;
    const target: ChannelStatus = prev && CHANNEL_STATUSES.includes(prev) && prev !== decided ? prev : "ACTIVE";
    const { count } = await tx.creator.updateMany({
      where: { id: channel.id, status: decided },
      data: { status: target, statusReason: "Odwołanie uwzględnione", statusChangedAt: ctx.now(), statusChangedById: adminId },
    });
    return count > 0 ? { reverted: true, note: `Status kanału: ${decided} -> ${target}.` } : { reverted: false, note: "Status kanału zmienił się w międzyczasie; nic nie cofnięto." };
  }

  if (decision.targetType === "VIDEO" && action.startsWith("VIDEO_") && VIDEO_STATES.includes(action.slice(6))) {
    const decided = action.slice(6);
    const video = await tx.video.findUnique({ where: { id: decision.targetId }, select: { id: true, moderationStatus: true } });
    if (!video) return { reverted: false, note: "Film już nie istnieje." };
    if (String(video.moderationStatus) !== decided) return { reverted: false, note: `Moderacja filmu zmieniła się od tamtej decyzji (teraz: ${video.moderationStatus}); nic nie cofnięto.` };
    const meta = await auditFor(tx, decision.id, ["VIDEO_MODERATION_CHANGED", "CONTENT_REPORT_RESOLVED"]);
    const prev = meta?.before?.moderationStatus;
    const target = prev && VIDEO_STATES.includes(prev) && prev !== decided ? prev : "VISIBLE";
    await tx.video.update({ where: { id: video.id }, data: { moderationStatus: target as never } });
    return { reverted: true, note: `Moderacja filmu: ${decided} -> ${target}.` };
  }

  if (action === "CHANNEL_STRIKE_ISSUED") {
    const meta = await auditFor(tx, decision.id, ["CHANNEL_STRIKE_ISSUED"]);
    if (!meta?.strikeId) return { reverted: false, note: "Nie znaleziono ostrzeżenia powiązanego z decyzją." };
    const { count } = await tx.channelStrike.updateMany({ where: { id: meta.strikeId, revokedAt: null }, data: { revokedAt: ctx.now() } });
    return count > 0 ? { reverted: true, note: "Ostrzeżenie cofnięte." } : { reverted: false, note: "Ostrzeżenie było już cofnięte lub wygasło." };
  }

  return { reverted: false, note: "Decyzja nie zmieniała stanu treści (nic do cofnięcia)." };
}

export async function resolveModerationAppeal(
  ctx: AppContext,
  input: { appealId: string; outcome: "UPHELD" | "REJECTED"; reasonPublic: string; reasonInternal?: string },
): Promise<UseCaseResult<{ outcomeDecisionId: string; reverted: boolean; note: string }, AppError>> {
  const denied = await authorize(ctx, "platform.moderate_channel");
  if (denied) return fail(denied);
  if (input.outcome !== "UPHELD" && input.outcome !== "REJECTED") return fail(new AppError("Nieprawidłowy wynik odwołania.", 400, "INVALID_OUTCOME"));
  const reasonPublic = input.reasonPublic.trim();
  if (reasonPublic.length < 3 || reasonPublic.length > 500) return fail(new AppError("Podaj uzasadnienie dla twórcy (3-500 znaków).", 400, "REASON_REQUIRED"));
  const reasonInternal = input.reasonInternal?.trim().slice(0, 500) || null;

  const appeal = await ctx.prisma.moderationAppeal.findUnique({
    where: { id: input.appealId },
    include: { decision: { select: { id: true, action: true, targetType: true, targetId: true, channelId: true } } },
  });
  if (!appeal) return fail(new AppError("Nie znaleziono odwołania.", 404, "APPEAL_NOT_FOUND"));
  if (appeal.status !== "PENDING") return fail(new AppError("To odwołanie jest już rozpatrzone.", 409, "APPEAL_RESOLVED"));
  const adminId = ctx.actor.type === "admin" ? ctx.actor.userId : null;
  const now = ctx.now();
  const action = input.outcome === "UPHELD" ? "APPEAL_UPHELD" : "APPEAL_REJECTED";

  let outcomeDecisionId: string;
  let result: Reverted = { reverted: false, note: "Odwołanie oddalone, stan treści bez zmian." };
  try {
    outcomeDecisionId = await ctx.db.writeTransaction(async (tx) => {
      const { count } = await tx.moderationAppeal.updateMany({
        where: { id: appeal.id, status: "PENDING" },
        data: { status: input.outcome, resolvedAt: now, resolvedByAdminId: adminId },
      });
      if (count === 0) throw new AppError("To odwołanie jest już rozpatrzone.", 409, "APPEAL_RESOLVED");
      if (input.outcome === "UPHELD") result = await revertDecisionEffect(ctx, tx, appeal.decision, adminId);
      const created = await tx.moderationDecision.create({
        data: {
          targetType: appeal.decision.targetType as never, targetId: appeal.decision.targetId, channelId: appeal.decision.channelId,
          action, reasonCode: "APPEAL", reasonPublic,
          reasonInternal: [reasonInternal, input.outcome === "UPHELD" ? result.note : null].filter(Boolean).join(" | ") || null,
          actorAdminId: adminId,
        },
        select: { id: true },
      });
      await tx.moderationAppeal.update({ where: { id: appeal.id }, data: { outcomeDecisionId: created.id } });
      await recordAuditEvent(ctx, {
        action: "MODERATION_APPEAL_RESOLVED", targetType: "ModerationAppeal", targetId: appeal.id, channelId: appeal.decision.channelId ?? undefined,
        metadata: { outcome: input.outcome, decisionId: appeal.decision.id, outcomeDecisionId: created.id, reverted: result.reverted, note: result.note },
      }, tx);
      return created.id;
    });
  } catch (error) {
    if (error instanceof AppError) return fail(error);
    throw error;
  }

  // After the commit and best effort: tell the person who appealed.
  if (appeal.decision.channelId) {
    await notifyChannelOwnerOfDecision(ctx, {
      decisionId: outcomeDecisionId,
      channelId: appeal.decision.channelId,
      action,
      reasonPublic,
      recipientUserId: appeal.userId,
      videoId: appeal.decision.targetType === "VIDEO" ? appeal.decision.targetId : null,
    });
  }
  return ok({ outcomeDecisionId, reverted: result.reverted, note: result.note });
}

