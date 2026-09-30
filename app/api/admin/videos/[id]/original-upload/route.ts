import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { provisionOriginalUpload, completeOriginalUpload } from "@/lib/modules/video";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminOriginalUploadProvisionSchema, adminOriginalUploadCompleteSchema } from "@/lib/api/admin-schemas";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("PROVISION_ORIGINAL_UPLOAD");
  if (response) return response;

  const videoId = params.id;
  const parsed = await parseAdminBody(req, adminOriginalUploadProvisionSchema, { allowEmpty: true });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
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
  const parsed = await parseAdminBody(req, adminOriginalUploadCompleteSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });

  const result = await completeOriginalUpload(
    {
      videoId,
      originalId: body.originalId,
      strategy: body.strategy as never,
      publishAfterReady: body.publishAfterReady,
      mirrorPlan: body.mirrorPlan as never,
      preferredProvider: body.preferredProvider,
    },
    ctx
  );

  return fromUseCaseResult(result);
}
