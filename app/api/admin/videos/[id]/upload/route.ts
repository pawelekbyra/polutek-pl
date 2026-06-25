import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { provisionCloudflareTusUpload, provisionCloudflareUpload } from "@/lib/modules/video";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { AppError } from "@/lib/modules/shared/app-error";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const { adminUserId, response } = await requireAdminForApi(
    "PROVISION_VIDEO_UPLOAD",
  );
  if (response) return response;

  const videoId = params.id;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor, requestId: requestId || undefined });
    const tusResumable = req.headers.get("tus-resumable");

    if (tusResumable) {
      const uploadLength = req.headers.get("upload-length");
      if (!uploadLength) {
        return fromUseCaseResult({
          ok: false,
          error: new AppError("TUS upload requires Upload-Length header", 400, "TUS_UPLOAD_LENGTH_REQUIRED"),
        });
      }

      const result = await provisionCloudflareTusUpload({
        videoId,
        uploadLength,
        uploadMetadata: req.headers.get("upload-metadata"),
      }, ctx);

      if (!result.ok) return fromUseCaseResult(result);

      return new NextResponse(null, {
        status: 201,
        headers: {
          Location: result.data.uploadUrl,
          "Tus-Resumable": "1.0.0",
          "Access-Control-Expose-Headers": "Location,Tus-Resumable",
        },
      });
    }

    const body = await req.json();

    const result = await provisionCloudflareUpload({
        videoId,
        fileName: body.fileName,
        fileSize: body.fileSize,
        contentType: body.contentType,
        thumbnailSource: body.thumbnailSource,
    }, ctx);

    return fromUseCaseResult(result);
  } catch (error: any) {
    return fromUseCaseResult({ ok: false, error });
  }
}
