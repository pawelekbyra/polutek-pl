import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { enqueueEncode } from "@/lib/modules/video-pipeline";
import { fromUseCaseResult } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

/** Starts a new encode of the video's active original ("Zakoduj ponownie"). Idempotent while a job is active. */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("VIDEO_ENCODE_ENQUEUE");
  if (response) return response;
  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });
  return fromUseCaseResult(await enqueueEncode({ videoId: id, auditAction: "VIDEO_ENCODE_REQUEUED" }, ctx));
}
