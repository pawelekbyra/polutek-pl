import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { presignOriginalParts } from "@/lib/modules/video-pipeline";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminMultipartPartsSchema } from "@/lib/api/admin-schemas";

export const dynamic = "force-dynamic";

/** Short-lived presigned PUT URLs for a batch of parts (the browser uploads straight to R2). */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("VIDEO_ORIGINAL_MULTIPART_PARTS");
  if (response) return response;
  const parsed = await parseAdminBody(req, adminMultipartPartsSchema);
  if (!parsed.ok) return parsed.response;
  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });
  return fromUseCaseResult(await presignOriginalParts({ videoId: id, ...parsed.data }, ctx));
}
