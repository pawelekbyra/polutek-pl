import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { abortOriginalUpload, listOriginalParts, startOriginalUpload } from "@/lib/modules/video-pipeline";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminMultipartStartSchema } from "@/lib/api/admin-schemas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function adminCtx(adminUserId: string) {
  return createAppContext({ actor: { type: "admin", userId: adminUserId }, requestId: getCorrelationId() ?? undefined });
}

/** Opens a resumable multipart upload of the ORIGINAL file to the private R2 bucket. */
export async function POST(req: NextRequest, props: Params) {
  const { id } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("VIDEO_ORIGINAL_MULTIPART_START");
  if (response) return response;
  const parsed = await parseAdminBody(req, adminMultipartStartSchema);
  if (!parsed.ok) return parsed.response;
  return fromUseCaseResult(await startOriginalUpload({ videoId: id, ...parsed.data }, adminCtx(adminUserId!)));
}

/** Parts R2 already holds, so a reloaded page can resume instead of starting over. */
export async function GET(req: NextRequest, props: Params) {
  const { id } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("VIDEO_ORIGINAL_MULTIPART_LIST");
  if (response) return response;
  const originalId = new URL(req.url).searchParams.get("originalId");
  if (!originalId) return NextResponse.json({ error: "originalId is required" }, { status: 400 });
  return fromUseCaseResult(await listOriginalParts({ videoId: id, originalId }, adminCtx(adminUserId!)));
}

/** Aborts an unfinished upload (R2 drops the uploaded parts). */
export async function DELETE(req: NextRequest, props: Params) {
  const { id } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("VIDEO_ORIGINAL_MULTIPART_ABORT");
  if (response) return response;
  const originalId = new URL(req.url).searchParams.get("originalId");
  if (!originalId) return NextResponse.json({ error: "originalId is required" }, { status: 400 });
  return fromUseCaseResult(await abortOriginalUpload({ videoId: id, originalId }, adminCtx(adminUserId!)));
}
