import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import {
  CloudflareApiError,
  CloudflareConfigurationError,
  VideoNotFoundError,
  VideoNotOnMainChannelError,
} from "../domain/video.errors";
import { VideoPolicy } from "../domain/video.policy";
import { VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { CloudflareStreamDeleteClient, DeleteCloudflareStreamAssetResult } from "../infrastructure/cloudflare-stream-delete.client";

export type DeleteAdminVideoError =
  | VideoNotFoundError
  | VideoNotOnMainChannelError
  | CloudflareApiError
  | CloudflareConfigurationError;

export async function deleteAdminVideo(
  videoId: string,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, DeleteAdminVideoError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const existing = await repository.findByIdWithAsset(videoId);
  if (!existing) return fail(new VideoNotFoundError(videoId));

  if (!VideoPolicy.isOnMainChannel(existing, mainChannel.id)) {
    return fail(new VideoNotOnMainChannelError(videoId));
  }

  const asset = existing.asset;
  let cloudflareDeletion: DeleteCloudflareStreamAssetResult | null = null;
  const shouldDeleteCloudflareAsset =
    asset?.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM && Boolean(asset.providerAssetId);

  if (shouldDeleteCloudflareAsset) {
    try {
      const client = new CloudflareStreamDeleteClient();
      cloudflareDeletion = await client.deleteAsset(asset!.providerAssetId!);
    } catch (error: unknown) {
      return fail(error as DeleteAdminVideoError);
    }
  }

  const deleted = await ctx.db.writeTransaction(async (tx) => {
    const video = await tx.video.delete({
      where: { id: videoId },
      include: {
        _count: { select: { comments: true } },
        assets: true,
      },
    });

    await recordAuditEvent(ctx, {
      action: "VIDEO_DELETED",
      targetType: "Video",
      targetId: video.id,
      metadata: {
        title: existing.title,
        slug: existing.slug,
        provider: asset?.provider ?? null,
        providerAssetId: asset?.providerAssetId ?? null,
        cloudflareDeleted: Boolean(cloudflareDeletion && !cloudflareDeletion.alreadyDeleted),
        cloudflareAlreadyDeleted: Boolean(cloudflareDeletion?.alreadyDeleted),
        cloudflareDeletionRequired: shouldDeleteCloudflareAsset,
      },
    }, tx);

    return video;
  });

  return ok(toAdminVideoDto(deleted));
}
