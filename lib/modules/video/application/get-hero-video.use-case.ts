import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PublicVideoDto, toPublicVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";

export async function getHeroVideo(
  ctx: AppContext
): Promise<UseCaseResult<PublicVideoDto | null>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findHero(mainChannel.id);

  if (!video) return ok(null);

  return ok(toPublicVideoDto(video));
}
