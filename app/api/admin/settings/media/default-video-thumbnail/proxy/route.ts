import { NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/prisma";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { ThumbnailResponseService } from "@/lib/modules/media";

export const dynamic = "force-dynamic";

const SETTING_KEY = "default_video_thumbnail";

// Streams the default-thumbnail blob for the admin settings preview. The blob
// may live in a private Vercel Blob store, so the raw storage URL is never
// exposed to the browser — this route fetches it server-side instead.
export async function GET() {
  try {
    const { response } = await requireAdminForApi("GET_DEFAULT_VIDEO_THUMBNAIL_PROXY");
    if (response) return response;

    const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!setting?.value) {
      return NextResponse.json({ error: "Default thumbnail not set" }, { status: 404 });
    }

    return ThumbnailResponseService.getThumbnailResponse(SETTING_KEY, setting.value);
  } catch (error) {
    return handleApiError(error);
  }
}
