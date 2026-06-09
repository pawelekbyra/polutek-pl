import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { VideoNotFoundError } from "../domain/video.errors";
import { MainChannelService } from "@/lib/modules/channel";

export type GetAdminVideoByIdInput = {
  idOrSlug: string;
};

export async function getAdminVideoById(
  input: GetAdminVideoByIdInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, VideoNotFoundError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findAdminByIdOrSlugForMainChannel(input.idOrSlug, mainChannel.id);

  if (!video) return fail(new VideoNotFoundError(input.idOrSlug));

  return ok(toAdminVideoDto(video));
}
