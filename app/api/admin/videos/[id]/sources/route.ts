import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { addVideoSource } from "@/lib/modules/video";
import { fromUseCaseResult, handleApiError } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_SOURCE");
  if (response) return response;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });
    const body = await req.json();

    const result = await addVideoSource(
      {
        videoId: params.id,
        provider: body.provider,
        providerAssetId: body.providerAssetId,
        youtubeUrl: body.youtubeUrl,
      },
      ctx
    );

    return fromUseCaseResult(result);
  } catch (error) {
    return handleApiError(error);
  }
}
