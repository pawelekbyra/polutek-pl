import { AccessTier, Prisma, StorageProvider, VideoDistributionTargetRole } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { canProviderServeTier, getPlaybackProviderCapabilities, isAutomaticFilePlaybackProvider } from "../domain/video-provider-capabilities";
import { normalizeVideoDistributionStrategy, VideoDistributionStrategyInput } from "../domain/video-distribution.types";

export type VideoDistributionPlanWithTargets = Prisma.VideoDistributionPlanGetPayload<{
  include: { targets: true };
}>;

function targetShape(input: {
  provider: StorageProvider;
  required: boolean;
  desiredPrimary: boolean;
  role: VideoDistributionTargetRole;
}) {
  return {
    provider: input.provider,
    videoId: "",
    required: input.required,
    desiredPrimary: input.desiredPrimary,
    role: input.role,
  };
}

export class VideoDistributionPlanService {
  async createOrReplaceActivePlan(input: {
    videoId: string;
    originalId?: string | null;
    strategy: VideoDistributionStrategyInput;
    publishAfterReady?: boolean;
    createdByAdminId?: string;
  }, ctx: AppContext): Promise<VideoDistributionPlanWithTargets> {
    const video = await ctx.prisma.video.findUnique({ where: { id: input.videoId }, select: { id: true, tier: true } });
    if (!video) throw new AppError("Video not found.", 404, "VIDEO_NOT_FOUND");

    const normalized = normalizeVideoDistributionStrategy(input.strategy);
    const targetInputs = normalized.providers.map((provider) => {
      if (!isAutomaticFilePlaybackProvider(provider)) {
        const label = getPlaybackProviderCapabilities(provider).label;
        throw new AppError(`${label} is not an automatic file playback provider.`, 400, "PROVIDER_NOT_AUTOMATIC_FILE");
      }
      if (!canProviderServeTier(provider, video.tier as AccessTier)) {
        throw new AppError(`${provider} cannot serve ${video.tier} videos.`, 400, "PROVIDER_CANNOT_SERVE_TIER");
      }

      if (normalized.mode === "SINGLE_PROVIDER") {
        return targetShape({ provider, required: true, desiredPrimary: true, role: VideoDistributionTargetRole.PRIMARY });
      }
      if (normalized.mode === "MULTI_PROVIDER" && normalized.preferredProvider) {
        const isPreferred = provider === normalized.preferredProvider;
        return targetShape({
          provider,
          required: isPreferred,
          desiredPrimary: isPreferred,
          role: isPreferred ? VideoDistributionTargetRole.PRIMARY : VideoDistributionTargetRole.BACKUP,
        });
      }
      return targetShape({ provider, required: false, desiredPrimary: false, role: VideoDistributionTargetRole.CANDIDATE });
    });

    return await ctx.db.writeTransaction(async (tx) => {
      await tx.videoDistributionPlan.updateMany({
        where: { videoId: input.videoId, isActive: true },
        data: { isActive: false },
      });

      return await tx.videoDistributionPlan.create({
        data: {
          videoId: input.videoId,
          originalId: input.originalId ?? null,
          mode: normalized.mode,
          selectionPolicy: normalized.selectionPolicy,
          autopublishPolicy: input.publishAfterReady === false ? "NEVER" : normalized.autopublishPolicy,
          preferredProvider: normalized.preferredProvider,
          isActive: true,
          createdByAdminId: input.createdByAdminId,
          targets: {
            create: targetInputs.map((target) => ({ ...target, videoId: input.videoId })),
          },
        },
        include: { targets: true },
      });
    });
  }
}
