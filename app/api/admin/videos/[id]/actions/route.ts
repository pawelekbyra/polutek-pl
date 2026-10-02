import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import {
  updateAdminVideo,
  publishAdminVideo,
  archiveAdminVideo,
} from "@/lib/modules/video";
import { fromUseCaseResult, handleApiError } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { VideoStatus } from "@prisma/client";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminLooseObjectSchema, adminVideoActionSchema } from "@/lib/api/admin-schemas";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } =
    await requireAdminForApi("PATCH_ADMIN_VIDEO");
  if (response) return response;

  const videoId = params.id;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });
    const parsed = await parseAdminBody(req, adminLooseObjectSchema);
    if (!parsed.ok) return parsed.response;

    // Video metadata is validated by the updateAdminVideo use case.
    const result = await updateAdminVideo({ ...parsed.data, id: videoId } as Parameters<typeof updateAdminVideo>[0], ctx);
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
    const parsedAction = await parseAdminBody(req, adminVideoActionSchema);
    if (!parsedAction.ok) return parsedAction.response;
    const body = parsedAction.data;
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
