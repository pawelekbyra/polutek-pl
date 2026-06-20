import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import {
  updateAdminVideo,
  publishAdminVideo,
  archiveAdminVideo,
  getCloudflareUploadUrl,
  attachCloudflareAsset,
  importLegacyVideoToCloudflare,
  syncCloudflareStatus,
} from "@/lib/modules/video";
import { fromUseCaseResult, handleApiError } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { VideoStatus } from "@prisma/client";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } =
    await requireAdminForApi("PATCH_ADMIN_VIDEO");
  if (response) return response;

  const videoId = params.id;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });
    const body = await req.json();

    const result = await updateAdminVideo({ ...body, id: videoId }, ctx);
    return fromUseCaseResult(result);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi(
    "POST_ADMIN_VIDEO_ACTION",
  );
  if (response) return response;

  const videoId = params.id;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "publish":
        return fromUseCaseResult(
          await publishAdminVideo(videoId, ctx),
        );
      case "unpublish":
        return fromUseCaseResult(
          await updateAdminVideo(
            { id: videoId, status: VideoStatus.DRAFT },
            ctx,
          ),
        );
      case "archive":
        return fromUseCaseResult(await archiveAdminVideo(videoId, ctx));
      case "restore":
        return fromUseCaseResult(
          await updateAdminVideo(
            { id: videoId, status: VideoStatus.DRAFT },
            ctx,
          ),
        );
      case "set-hero":
        return fromUseCaseResult(
          await updateAdminVideo(
            {
              id: videoId,
              isMainFeatured: true,
            },
            ctx,
          ),
        );
      case "create-upload-url":
        return fromUseCaseResult(
          await getCloudflareUploadUrl({ videoId }, ctx),
        );
      case "attach-asset": {
        const { providerAssetId, providerPlaybackId } = body;
        return fromUseCaseResult(
          await attachCloudflareAsset(
            { videoId, providerAssetId, providerPlaybackId, publishAfterAssetReady: body.publishAfterAssetReady === true },
            ctx,
          ),
        );
      }
      case "import-legacy-to-cloudflare":
        return fromUseCaseResult(
          await importLegacyVideoToCloudflare(
            {
              videoId,
              publishAfterAssetReady: body.publishAfterAssetReady === true,
            },
            ctx,
          ),
        );
      case "sync-cloudflare":
        return fromUseCaseResult(
          await syncCloudflareStatus(videoId, ctx),
        );
      default:

        return fromUseCaseResult({
          ok: false,
          error: {
            code: "INVALID_ACTION",
            message:
              `Action ${action} not supported`,
            statusCode:
              400,
          } as any,
        });
    }
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
