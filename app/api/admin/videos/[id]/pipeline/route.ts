import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { getPipelineState } from "@/lib/modules/video-pipeline";
import { fromUseCaseResult } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

/** Upload + encoding state of a video (polled by the admin panel). */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("VIDEO_PIPELINE_STATE");
  if (response) return response;
  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });
  const result = await getPipelineState({ videoId: id }, ctx);
  if (!result.ok) return fromUseCaseResult(result);
  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
