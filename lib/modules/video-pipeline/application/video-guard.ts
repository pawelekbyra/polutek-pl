import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { MainChannelService } from "@/lib/modules/channel";

/** The video must exist on the main channel; throws a 404 AppError otherwise. */
export async function requireVideo(videoId: string, ctx: AppContext) {
  const channel = await MainChannelService.getRequired(ctx);
  const video = await ctx.prisma.video.findFirst({
    where: { id: videoId, creatorId: channel.id },
    select: { id: true, title: true, status: true, activeOriginalId: true },
  });
  if (!video) throw new AppError("Film nie istnieje.", 404, "VIDEO_NOT_FOUND");
  return video;
}

export function actorId(ctx: AppContext): string | null {
  return ctx.actor.type === "admin" ? ctx.actor.userId : null;
}
