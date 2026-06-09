import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PublicVideoDto, toPublicVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";

export async function getPublicVideoList(
  ctx: AppContext
): Promise<UseCaseResult<PublicVideoDto[]>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const videos = await repository.findPublicList(mainChannel.id, new Date());

  // Filtering for PATRON tier would normally happen here or in repository
  // For now, returning all published ones on main channel

  return ok(videos.map(toPublicVideoDto));
}
