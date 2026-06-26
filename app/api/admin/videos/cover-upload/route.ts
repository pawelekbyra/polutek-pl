import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || "unknown";
  const scopedLogger = createScopedLogger(requestId);

  const { response: adminResponse } = await requireAdminForApi("POST_ADMIN_VIDEO_COVER_UPLOAD");
  if (adminResponse) return adminResponse;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const videoId = formData.get("videoId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPG, PNG, WebP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max: 5 MB" },
        { status: 400 }
      );
    }

    const uuid = crypto.randomUUID();
    const extension = file.type.split("/")[1] || "webp";
    const videoPath = videoId ? videoId : "new";
    const pathname = `videos/${videoPath}/covers/${uuid}.${extension}`;

    const blob = await put(pathname, file, {
      access: (process.env.VERCEL_BLOB_ACCESS as any) || "public",
    });

    scopedLogger.info("[ADMIN_VIDEO_COVER_UPLOAD_SUCCESS]", {
      pathname,
      url: blob.url,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error: any) {
    scopedLogger.error("[ADMIN_VIDEO_COVER_UPLOAD_ERROR]", error);

    if (error?.message?.includes("public access") || error?.message?.includes("private store")) {
      return NextResponse.json(
        {
          error: "Vercel Blob storage is configured for private access. The 'public' access mode is forbidden. Upload failed.",
          details: error.message
        },
        { status: 400 }
      );
    }

    return handleApiError(error);
  }
}
