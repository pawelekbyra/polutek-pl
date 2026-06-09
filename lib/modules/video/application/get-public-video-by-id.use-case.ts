import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PublicVideoDto, toPublicVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { VideoNotFoundError } from "../domain/video.errors";

export async function getPublicVideoById(
  id: string,
  ctx: AppContext
): Promise<UseCaseResult<PublicVideoDto, VideoNotFoundError>> {
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findById(id);

  if (!video) return fail(new VideoNotFoundError(id));

  return ok(toPublicVideoDto(video));
}
