import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { cancelEncode } from "@/lib/modules/video-pipeline";
import { fromUseCaseResult } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

/** Cancels an encode job: queued ones at once, a running one when the worker next checks in (seconds). */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string; jobId: string }> }) {
  const { id, jobId } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("VIDEO_ENCODE_CANCEL");
  if (response) return response;
  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });
  return fromUseCaseResult(await cancelEncode({ videoId: id, jobId }, ctx));
}
