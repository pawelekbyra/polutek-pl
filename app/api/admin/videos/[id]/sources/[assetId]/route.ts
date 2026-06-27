import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { handleApiError, fromUseCaseResult } from "@/lib/api/api-response";
import { makeSourcePrimary } from "@/lib/modules/video/application/make-source-primary.use-case";
import { deleteVideoSource } from "@/lib/modules/video/application/delete-video-source.use-case";
import { syncCloudflareStatus } from "@/lib/modules/video";

type RouteParams = { params: Promise<{ id: string; assetId: string }> };

export async function POST(req: NextRequest, props: RouteParams) {
  const { id: videoId, assetId } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_SOURCE_ACTION");
  if (response) return response;

  try {
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! } });
    const { action } = await req.json();

    if (action === "make-primary") {
      return fromUseCaseResult(await makeSourcePrimary({ videoId, assetId }, ctx));
    }
    if (action === "sync") {
      return fromUseCaseResult(await syncCloudflareStatus(videoId, ctx));
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, props: RouteParams) {
  const { id: videoId, assetId } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("DELETE_ADMIN_VIDEO_SOURCE");
  if (response) return response;

  try {
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! } });
    return fromUseCaseResult(await deleteVideoSource({ videoId, assetId }, ctx));
  } catch (error) {
    return handleApiError(error);
  }
}
