import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotOnMainChannelError } from "../domain/video.errors";

export async function reorderAdminVideos(
  updates: Array<{ id: string; sidebarOrder: number; showInSidebar: boolean }>,
  ctx: AppContext
): Promise<UseCaseResult<void, VideoNotOnMainChannelError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  try {
    await (ctx.prisma as any).$transaction(async (tx: any) => {
        await repository.reorder(updates, mainChannel.id, tx);

        await recordAuditEvent(ctx, {
            action: 'VIDEO_REORDERED',
            targetType: 'Channel',
            targetId: mainChannel.id,
            metadata: { count: updates.length }
        }, tx);
    });
    return ok(undefined);
  } catch (error: any) {
      if (error.message?.includes('does not belong to main channel')) {
          return fail(new VideoNotOnMainChannelError('batch'));
      }
      throw error;
  }
}
