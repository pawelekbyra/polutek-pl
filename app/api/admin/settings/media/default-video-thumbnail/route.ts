import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { prisma } from "../../../../../../lib/prisma";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { getBlobAccess } from "@/lib/blob-config";
import { invalidateDefaultThumbnailCache } from "@/lib/modules/media";

export const dynamic = "force-dynamic";

const SETTING_KEY = "default_video_thumbnail";
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function GET() {
  try {
    const { response } = await requireAdminForApi("GET_DEFAULT_VIDEO_THUMBNAIL");
    if (response) return response;

    const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });

    if (!setting) {
      return NextResponse.json({ url: null });
    }

    const access = getBlobAccess();
    const proxyUrl = access === "private" ? "/api/admin/settings/media/default-video-thumbnail/proxy" : setting.value;

    return NextResponse.json({ url: proxyUrl, storageUrl: setting.value });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { adminUserId, response } = await requireAdminForApi("POST_DEFAULT_VIDEO_THUMBNAIL");
    if (response) return response;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: jpeg, png, webp" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Max: 5 MB" }, { status: 400 });
    }

    const ext = file.type.split("/")[1] || "jpg";
    const pathname = `settings/default-video-thumbnail.${ext}`;
    const access = getBlobAccess();

    const existing = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (existing) {
      await del(existing.value).catch(() => null);
    }

    const blob = await put(pathname, file, { access });

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: blob.url, updatedBy: adminUserId ?? undefined },
      update: { value: blob.url, updatedBy: adminUserId ?? undefined },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: adminUserId ?? null,
        action: "UPDATE_DEFAULT_VIDEO_THUMBNAIL",
        targetType: "AppSetting",
        targetId: SETTING_KEY,
      },
    });

    invalidateDefaultThumbnailCache();

    const proxyUrl = access === "private" ? "/api/admin/settings/media/default-video-thumbnail/proxy" : blob.url;

    return NextResponse.json({ url: proxyUrl, storageUrl: blob.url });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const { adminUserId, response } = await requireAdminForApi("DELETE_DEFAULT_VIDEO_THUMBNAIL");
    if (response) return response;

    const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });

    if (!setting) {
      return NextResponse.json({ ok: true, deleted: false });
    }

    await del(setting.value).catch(() => null);
    await prisma.appSetting.delete({ where: { key: SETTING_KEY } });
    invalidateDefaultThumbnailCache();

    await prisma.auditLog.create({
      data: {
        actorUserId: adminUserId ?? null,
        action: "DELETE_DEFAULT_VIDEO_THUMBNAIL",
        targetType: "AppSetting",
        targetId: SETTING_KEY,
      },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
