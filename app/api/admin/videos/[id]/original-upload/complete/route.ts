import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { completeOriginalUpload } from "@/lib/modules/video";
import { getCorrelationId } from "@/lib/utils/correlation";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const { adminUserId, response } = await requireAdminForApi("COMPLETE_VIDEO_ORIGINAL_UPLOAD");
  if (response) return response;

  try {
    const body = await req.json();
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    const result = await completeOriginalUpload({
      videoId: params.id,
      originalId: body.originalId,
    }, ctx);

    return fromUseCaseResult(result);
  } catch (error: any) {
    return fromUseCaseResult({ ok: false, error });
  }
}
