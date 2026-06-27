import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { handleApiError } from "@/lib/api/api-response";
import { provisionAdditionalCloudflareSource } from "@/lib/modules/video/application/provision-additional-cloudflare-source.use-case";

// TUS resumable upload endpoint dla dodawania nowego źródła CF do istniejącego filmu.
// Działa niezależnie od statusu filmu i nie nadpisuje primary assetu.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: videoId } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_SOURCE_UPLOAD");
  if (response) return response;

  const isTus = Boolean(req.headers.get("tus-resumable"));

  if (!isTus) {
    return NextResponse.json({ error: "Only TUS uploads are supported on this endpoint." }, { status: 400 });
  }

  try {
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! } });
    const uploadLength = req.headers.get("upload-length") || "0";
    const uploadMetadata = req.headers.get("upload-metadata");

    const result = await provisionAdditionalCloudflareSource({ videoId, uploadLength, uploadMetadata }, ctx);
    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: (result.error as any).statusCode || 500 });
    }

    return new NextResponse(null, {
      status: 201,
      headers: {
        Location: result.data.uploadUrl,
        "Tus-Resumable": "1.0.0",
        "X-Provider-Asset-Id": result.data.providerAssetId,
        "X-Asset-Id": result.data.assetId,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
