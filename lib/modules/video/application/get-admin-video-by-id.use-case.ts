import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { VideoNotFoundError } from "../domain/video.errors";
import { MainChannelService } from "@/lib/modules/channel";
import { authorize } from "@/lib/modules/authz";
import { AppError } from "@/lib/modules/shared/app-error";

export type GetAdminVideoByIdInput = {
  idOrSlug: string;
};

export async function getAdminVideoById(
  input: GetAdminVideoByIdInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, VideoNotFoundError | AppError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "video.preview", { channel: { id: mainChannel.id, ownerUserId: mainChannel.userId, status: mainChannel.status } });
  if (denied) return fail(denied);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findAdminByIdOrSlugForMainChannel(input.idOrSlug, mainChannel.id);

  if (!video) return fail(new VideoNotFoundError(input.idOrSlug));

  return ok(toAdminVideoDto(video));
}
