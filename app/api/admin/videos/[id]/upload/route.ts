import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { provisionCloudflareUpload } from "@/lib/modules/video";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const requestId = getCorrelationId();
  const { adminUserId, response } = await requireAdminForApi(
    "PROVISION_VIDEO_UPLOAD",
  );
  if (response) return response;

  const videoId = params.id;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor, requestId: requestId || undefined });
    const body = await req.json();

    const result = await provisionCloudflareUpload({
        videoId,
        fileName: body.fileName,
        fileSize: body.fileSize,
        contentType: body.contentType
    }, ctx);

    return fromUseCaseResult(result);
  } catch (error: any) {
    return fromUseCaseResult({ ok: false, error });
  }
}
