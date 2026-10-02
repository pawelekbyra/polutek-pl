import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { deleteSelfHlsAsset } from "@/lib/modules/video-pipeline";
import { fromUseCaseResult } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

/** Deletes one encoded version (R2 objects + asset row). Refused while it plays a published video. */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("VIDEO_SELF_HLS_ASSET_DELETE");
  if (response) return response;
  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });
  return fromUseCaseResult(await deleteSelfHlsAsset({ videoId: id, assetId }, ctx));
}
