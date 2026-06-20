import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository, VideoFilterOptions } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";

export async function getAdminVideoList(
  filters: VideoFilterOptions,
  ctx: AppContext
): Promise<UseCaseResult<{ items: AdminVideoDto[]; total: number; page: number; totalPages: number }>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const { items, total } = await repository.findAdminList(mainChannel.id, filters);
  const limit = filters.limit || 20;

  return ok({
    items: items.map((video) => {
      const dto = toAdminVideoDto(video);
      return {
        ...dto,
        publishAfterAssetReady: Boolean(video.publishAfterAssetReady),
        publishAfterAssetReadyCompletedAt: video.publishAfterAssetReadyCompletedAt || null,
        publishAfterAssetReadyError: video.publishAfterAssetReadyError || null,
      };
    }),
    total,
    page: filters.page || 1,
    totalPages: Math.ceil(total / limit)
  });
}
