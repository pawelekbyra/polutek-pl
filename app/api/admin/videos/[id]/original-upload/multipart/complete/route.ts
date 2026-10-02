import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { completeOriginalMultipart } from "@/lib/modules/video-pipeline";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminMultipartCompleteSchema } from "@/lib/api/admin-schemas";

export const dynamic = "force-dynamic";

/** Finishes the upload, verifies the stored file (size, magic bytes) and queues encoding. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("VIDEO_ORIGINAL_MULTIPART_COMPLETE");
  if (response) return response;
  const parsed = await parseAdminBody(req, adminMultipartCompleteSchema);
  if (!parsed.ok) return parsed.response;
  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });
  return fromUseCaseResult(await completeOriginalMultipart({ videoId: id, ...parsed.data }, ctx));
}
