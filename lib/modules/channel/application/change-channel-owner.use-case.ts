import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { recordAuditEvent } from "@/lib/modules/audit";
import { MainChannelService } from "./main-channel.service";
import { assertAuthorized, authorize } from "@/lib/modules/authz";

/**
 * "Konto kanału": the site account that is the channel's creator (Creator.userId: the creator badge on
 * comments, replies as the creator). A deliberately small, audited operation: the new owner must be an
 * existing, non-deleted account, and the change records the old and the new owner.
 */
export type ChannelOwnerCandidate = { id: string; email: string; name: string | null };

export async function findChannelOwnerCandidates(ctx: AppContext, query: string): Promise<ChannelOwnerCandidate[]> {
  await assertAuthorized(ctx, "platform.settings");
  const q = query.trim().slice(0, 120);
  if (q.length < 3) return [];
  return ctx.prisma.user.findMany({
    where: { isDeleted: false, OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] },
    select: { id: true, email: true, name: true },
    orderBy: { email: "asc" },
    take: 8,
  });
}

export async function changeChannelOwner(
  ctx: AppContext,
  input: { userId: string; reason?: string },
): Promise<UseCaseResult<{ previousUserId: string; owner: ChannelOwnerCandidate }, AppError>> {
  const denied = await authorize(ctx, "platform.settings");
  if (denied) return fail(denied);
  const channel = await MainChannelService.getRequired(ctx);
  if (channel.userId === input.userId) return fail(new AppError("To konto już jest kontem kanału.", 409, "CHANNEL_OWNER_UNCHANGED"));
  const owner = await ctx.prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, email: true, name: true, isDeleted: true } });
  if (!owner || owner.isDeleted) return fail(new AppError("Nie ma takiego konta (albo zostało usunięte).", 404, "CHANNEL_OWNER_NOT_FOUND"));

  try {
    await ctx.db.writeTransaction(async (tx) => {
      // Compare-and-set on the previous owner: two tabs cannot both "win" silently.
      const { count } = await tx.creator.updateMany({ where: { id: channel.id, userId: channel.userId }, data: { userId: owner.id } });
      if (count === 0) throw new AppError("Konto kanału zmieniło się w międzyczasie. Odśwież stronę.", 409, "CHANNEL_OWNER_CONFLICT");
      await recordAuditEvent(ctx, {
        action: "CHANNEL_OWNER_CHANGED",
        targetType: "Creator",
        targetId: channel.id,
        metadata: { before: { userId: channel.userId }, after: { userId: owner.id }, reason: input.reason?.slice(0, 300) ?? null },
      }, tx);
    });
  } catch (error) {
    if (error instanceof AppError) return fail(error);
    throw error;
  }
  return ok({ previousUserId: channel.userId, owner: { id: owner.id, email: owner.email, name: owner.name } });
}

/** The current owner account, for the settings screen. */
export async function getChannelOwner(ctx: AppContext): Promise<ChannelOwnerCandidate | null> {
  if (ctx.actor.type !== "admin") throw new AppError("Only admins can read the channel owner", 403, "FORBIDDEN");
  const channel = await MainChannelService.getRequired(ctx);
  return ctx.prisma.user.findUnique({ where: { id: channel.userId }, select: { id: true, email: true, name: true } });
}
