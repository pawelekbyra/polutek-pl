import type { AppContext } from "@/lib/modules/shared/app-context";
import type { DbClient } from "@/lib/modules/shared/db";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { recordAuditEvent } from "@/lib/modules/audit";
import { authorize } from "@/lib/modules/authz";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";

/**
 * A channel's block list (`ChannelBan`): a viewer the channel's moderators blocked may still watch, but cannot comment
 * or reply under the channel's videos. Enforced in `createVideoComment` through `isBannedFromChannel`. The reason is
 * for the creator's own use and is never shown to the blocked viewer.
 */

export const BAN_REASON_MAX = 500;
/** A temporary block lasts at most five years; longer is "until further notice". */
const MAX_BAN_MS = 5 * 365 * 24 * 60 * 60 * 1000;

export type ChannelBanRow = {
  userId: string;
  name: string | null;
  until: Date | null;
  reason: string | null;
  createdAt: Date;
};

/** True when `userId` has an active block (no end date, or an end date in the future) on the channel. */
export async function isBannedFromChannel(prisma: Pick<DbClient, "channelBan">, channelId: string, userId: string, now: Date): Promise<boolean> {
  const ban = await prisma.channelBan.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { until: true },
  });
  if (!ban) return false;
  return ban.until === null || ban.until.getTime() > now.getTime();
}

async function loadChannelFacts(ctx: AppContext, channelId: string) {
  return ctx.prisma.creator.findUnique({
    where: { id: channelId },
    select: { id: true, userId: true, status: true, members: { select: { userId: true } } },
  });
}

export async function banViewerFromChannel(
  ctx: AppContext,
  input: { channelId: string; userId: string; until?: Date | null; reason?: string | null },
): Promise<UseCaseResult<{ userId: string; until: Date | null }, CommentError>> {
  try {
    const channel = await loadChannelFacts(ctx, input.channelId);
    if (!channel) return fail({ type: "NOT_FOUND", message: "Nie znaleziono kanału." });
    const denied = await authorize(ctx, "comment.moderate", { channelId: channel.id });
    if (denied) return fail({ type: denied.statusCode === 404 ? "NOT_FOUND" : "UNAUTHORIZED", message: denied.message });

    // Nobody blocks themselves, the channel's owner or its members (a block is for viewers).
    if (ctx.actor.type !== "guest" && "userId" in ctx.actor && ctx.actor.userId === input.userId) {
      return fail({ type: "VALIDATION_ERROR", message: "Nie możesz zablokować samego siebie." });
    }
    if (channel.userId === input.userId || channel.members.some((m) => m.userId === input.userId)) {
      return fail({ type: "VALIDATION_ERROR", message: "Nie można zablokować właściciela ani członka kanału." });
    }
    const target = await ctx.prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, role: true, isDeleted: true } });
    if (!target || target.isDeleted) return fail({ type: "NOT_FOUND", message: "Nie znaleziono użytkownika." });
    if (String(target.role) === "ADMIN") return fail({ type: "VALIDATION_ERROR", message: "Nie można zablokować administratora platformy." });

    const now = ctx.now();
    const until = input.until ?? null;
    if (until) {
      if (Number.isNaN(until.getTime()) || until.getTime() <= now.getTime()) return fail({ type: "VALIDATION_ERROR", message: "Data końca blokady musi być w przyszłości." });
      if (until.getTime() - now.getTime() > MAX_BAN_MS) return fail({ type: "VALIDATION_ERROR", message: "Blokada może trwać najwyżej 5 lat. Zostaw pole puste, aby zablokować bezterminowo." });
    }
    const reason = input.reason?.trim().slice(0, BAN_REASON_MAX) || null;

    await ctx.db.writeTransaction(async (tx) => {
      await tx.channelBan.upsert({
        where: { channelId_userId: { channelId: channel.id, userId: input.userId } },
        create: { channelId: channel.id, userId: input.userId, until, reason },
        update: { until, reason },
      });
      await recordAuditEvent(ctx, {
        action: "CHANNEL_BAN_CREATED", targetType: "User", targetId: input.userId, channelId: channel.id,
        metadata: { until: until ? until.toISOString() : null, hasReason: reason !== null },
      }, tx);
    });
    return ok({ userId: input.userId, until });
  } catch (error) {
    return fail(commentDatabaseError("CHANNEL_BAN_CREATE_ERROR", error));
  }
}

export async function unbanViewerFromChannel(
  ctx: AppContext,
  input: { channelId: string; userId: string },
): Promise<UseCaseResult<undefined, CommentError>> {
  try {
    const channel = await loadChannelFacts(ctx, input.channelId);
    if (!channel) return fail({ type: "NOT_FOUND", message: "Nie znaleziono kanału." });
    const denied = await authorize(ctx, "comment.moderate", { channelId: channel.id });
    if (denied) return fail({ type: denied.statusCode === 404 ? "NOT_FOUND" : "UNAUTHORIZED", message: denied.message });

    const existing = await ctx.prisma.channelBan.findUnique({
      where: { channelId_userId: { channelId: channel.id, userId: input.userId } },
      select: { userId: true },
    });
    if (!existing) return fail({ type: "NOT_FOUND", message: "Ten użytkownik nie jest zablokowany." });
    await ctx.db.writeTransaction(async (tx) => {
      await tx.channelBan.delete({ where: { channelId_userId: { channelId: channel.id, userId: input.userId } } });
      await recordAuditEvent(ctx, {
        action: "CHANNEL_BAN_REMOVED", targetType: "User", targetId: input.userId, channelId: channel.id, metadata: {},
      }, tx);
    });
    return ok(undefined);
  } catch (error) {
    return fail(commentDatabaseError("CHANNEL_BAN_REMOVE_ERROR", error));
  }
}

export async function listChannelBans(ctx: AppContext, input: { channelId: string }): Promise<UseCaseResult<{ items: ChannelBanRow[] }, CommentError>> {
  try {
    const channel = await loadChannelFacts(ctx, input.channelId);
    if (!channel) return fail({ type: "NOT_FOUND", message: "Nie znaleziono kanału." });
    const denied = await authorize(ctx, "comment.moderate", { channelId: channel.id });
    if (denied) return fail({ type: denied.statusCode === 404 ? "NOT_FOUND" : "UNAUTHORIZED", message: denied.message });

    const now = ctx.now();
    const rows = await ctx.prisma.channelBan.findMany({
      where: { channelId: channel.id, OR: [{ until: null }, { until: { gt: now } }] },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { userId: true, until: true, reason: true, createdAt: true, user: { select: { name: true, username: true } } },
    });
    return ok({
      items: rows.map((r) => ({ userId: r.userId, name: r.user?.name?.trim() || r.user?.username || null, until: r.until, reason: r.reason, createdAt: r.createdAt })),
    });
  } catch (error) {
    return fail(commentDatabaseError("CHANNEL_BAN_LIST_ERROR", error));
  }
}
