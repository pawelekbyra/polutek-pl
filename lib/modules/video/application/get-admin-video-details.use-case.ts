import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto } from "../domain/video.dto";
import { getAdminVideoById } from "./get-admin-video-by-id.use-case";
import { getAdminVideoDiagnostics, DiagnosticIssue } from "./get-admin-video-diagnostics.use-case";
import { syncCloudflareStatus } from "./sync-cloudflare-status.use-case";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { getAuditLogs } from "@/lib/modules/audit";

export type GetAdminVideoDetailsInput = {
  idOrSlug: string;
};

export type AdminVideoDetailsDto = AdminVideoDto & {
  diagnostics: DiagnosticIssue[];
  auditLogs: any[];
};

function shouldSyncCloudflareStatus(video: AdminVideoDto): boolean {
  return video.asset?.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM
    && Boolean(video.asset.providerAssetId)
    && [
      VIDEO_ASSET_PROCESSING_STATE.PENDING,
      VIDEO_ASSET_PROCESSING_STATE.UPLOADING,
      VIDEO_ASSET_PROCESSING_STATE.PROCESSING,
    ].includes(video.asset.processingState);
}

export async function getAdminVideoDetails(
  input: GetAdminVideoDetailsInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDetailsDto>> {
  let videoResult = await getAdminVideoById(input, ctx);
  if (!videoResult.ok) return fail(videoResult.error);

  let video = videoResult.data;
  const videoId = video.id;

  if (shouldSyncCloudflareStatus(video)) {
    const syncResult = await syncCloudflareStatus(videoId, ctx);
    if (syncResult.ok) {
      const refreshedVideoResult = await getAdminVideoById({ idOrSlug: videoId }, ctx);
      if (refreshedVideoResult.ok) {
        video = refreshedVideoResult.data;
      }
    }
  }

  const diagnosticsResult = await getAdminVideoDiagnostics({ videoId }, ctx);
  const diagnostics = diagnosticsResult.ok ? diagnosticsResult.data : [];

  const auditLogsResult = await getAuditLogs({
    targetType: 'Video',
    targetId: videoId,
    limit: 50
  }, ctx);
  const auditLogs = auditLogsResult.ok ? auditLogsResult.data : [];

  return ok({
    ...video,
    diagnostics,
    auditLogs
  });
}
