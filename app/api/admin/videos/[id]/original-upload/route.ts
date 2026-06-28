import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { provisionOriginalUpload } from "@/lib/modules/video/application/provision-original-upload.use-case";
import { completeOriginalUpload } from "@/lib/modules/video/application/complete-original-upload.use-case";
import { fromUseCaseResult } from "@/lib/api/api-response";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("PROVISION_ORIGINAL_UPLOAD");
  if (response) return response;

  const videoId = params.id;
  const body = await req.json().catch(() => ({}));
  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });

  const result = await provisionOriginalUpload(
    {
      videoId,
      fileName: body.fileName,
      fileSize: body.fileSize,
      contentType: body.contentType,
    },
    ctx
  );

  return fromUseCaseResult(result);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("COMPLETE_ORIGINAL_UPLOAD");
  if (response) return response;

  const videoId = params.id;
  const body = await req.json().catch(() => ({}));
  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });

  const result = await completeOriginalUpload(
    {
      videoId,
      originalId: body.originalId,
      mirrorPlan: body.mirrorPlan,
    },
    ctx
  );

  return fromUseCaseResult(result);
}
