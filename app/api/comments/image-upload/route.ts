import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getActorFromAuth } from "@/lib/api/auth";
import { handleApiError } from "@/lib/errors";
import { getBlobAccess } from "@/lib/blob-config";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const actor = await getActorFromAuth();
    if (actor.type === "anonymous") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Max: 5 MB" }, { status: 400 });
    }

    const uuid = crypto.randomUUID();
    const ext = file.type.split("/")[1] || "jpg";
    const pathname = `comments/images/${uuid}.${ext}`;
    const access = getBlobAccess();

    const blob = await put(pathname, file, { access });

    const url = access === "private"
      ? `/api/comments/image-proxy/${uuid}.${ext}`
      : blob.url;

    return NextResponse.json({ url, storageUrl: blob.url });
  } catch (error) {
    return handleApiError(error);
  }
}
