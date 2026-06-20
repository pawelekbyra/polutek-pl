import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository, CreateVideoInput } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoSlugConflictError } from "../domain/video.errors";
import { Prisma } from "@prisma/client";

const DEFAULT_DRAFT_THUMBNAIL_URL = "/logo.png";

function normalizeCreateVideoInput(input: CreateVideoInput): CreateVideoInput | AppError {
  const title = input.title?.trim();
  if (!title) {
    return new AppError("Podaj tytuł filmu przed utworzeniem szkicu.", 400, "VIDEO_TITLE_REQUIRED");
  }

  const slug = input.slug?.trim();
  if (!slug) {
    return new AppError("Podaj lub wygeneruj slug filmu przed utworzeniem szkicu.", 400, "VIDEO_SLUG_REQUIRED");
  }

  return {
    title,
    slug,
    thumbnailUrl: input.thumbnailUrl?.trim() || DEFAULT_DRAFT_THUMBNAIL_URL,
    duration: input.duration?.trim() || null,
    tier: input.tier,
    description: input.description?.trim() || null,
    titleEn: input.titleEn?.trim() || null,
    descriptionEn: input.descriptionEn?.trim() || null,
  };
}

export async function createAdminVideo(
  input: CreateVideoInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, AppError>> {
  const normalizedInput = normalizeCreateVideoInput(input);
  if (normalizedInput instanceof AppError) return fail(normalizedInput);

  const mainChannel = await MainChannelService.getRequired(ctx);

  const repository = new VideoRepository(ctx.prisma);

  try {
    const video = await ctx.db.writeTransaction(async (tx) => {
      const created = await repository.createForMainChannel(normalizedInput, mainChannel.id, tx);

      await recordAuditEvent(ctx, {
        action: 'VIDEO_CREATED',
        targetType: 'Video',
        targetId: created.id,
        metadata: { title: created.title }
      }, tx);

      return created;
    });

    return ok(toAdminVideoDto(video));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return fail(new VideoSlugConflictError(normalizedInput.slug));
    }
    throw error;
  }
}
