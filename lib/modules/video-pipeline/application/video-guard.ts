import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { MainChannelService } from "@/lib/modules/channel";
import { assertAuthorized, type AuthzAction } from "@/lib/modules/authz";

/**
 * The video must exist on the main channel (404 otherwise) and the actor must be allowed `action` on that channel
 * (403 otherwise, CLAUDE.md 4.23). Every pipeline entry point goes through here.
 */
export async function requireVideo(videoId: string, ctx: AppContext, action: AuthzAction = "video.update") {
  const channel = await MainChannelService.getRequired(ctx);
  const video = await ctx.prisma.video.findFirst({
    where: { id: videoId, creatorId: channel.id },
    select: { id: true, title: true, status: true, activeOriginalId: true },
  });
  if (!video) throw new AppError("Film nie istnieje.", 404, "VIDEO_NOT_FOUND");
  await assertAuthorized(ctx, action, { channel: { id: channel.id, ownerUserId: channel.userId, status: channel.status } });
  return video;
}

export function actorId(ctx: AppContext): string | null {
  return ctx.actor.type === "admin" ? ctx.actor.userId : null;
}
