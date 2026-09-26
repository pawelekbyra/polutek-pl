import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { prisma } from "../../../../../../lib/prisma";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { getBlobAccess } from "@/lib/blob-config";
import {
  invalidateDefaultThumbnailCache,
  MediaStorageService,
  R2ThumbnailStorageClient,
  parsePrivateThumbnailStorageUrl,
  THUMBNAIL_EXTENSION_BY_MIME,
} from "@/lib/modules/media";

export const dynamic = "force-dynamic";

const SETTING_KEY = "default_video_thumbnail";
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PROXY_URL = "/api/admin/settings/media/default-video-thumbnail/proxy";

async function deleteStoredThumbnail(storageUrl: string) {
  if (parsePrivateThumbnailStorageUrl(storageUrl, process.env)) {
    await MediaStorageService.deleteOwnedThumbnail(storageUrl);
    return;
  }
  await del(storageUrl).catch(() => null);
}

// Private Blob and R2 objects can't be shown to the browser directly.
function toAdminPreviewUrl(storageUrl: string): string {
  if (parsePrivateThumbnailStorageUrl(storageUrl, process.env)) return PROXY_URL;
  return getBlobAccess() === "private" ? PROXY_URL : storageUrl;
}

export async function GET() {
  try {
    const { response } = await requireAdminForApi("GET_DEFAULT_VIDEO_THUMBNAIL");
    if (response) return response;

    const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });

    if (!setting) {
      return NextResponse.json({ url: null });
    }

    return NextResponse.json({ url: toAdminPreviewUrl(setting.value), storageUrl: setting.value });
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

    const existing = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });

    let storageUrl: string | null = null;
    if (R2ThumbnailStorageClient.isConfigured()) {
      try {
        ({ storageUrl } = await new R2ThumbnailStorageClient().putPrivate({
          scope: "settings/default-video-thumbnail",
          bytes: new Uint8Array(await file.arrayBuffer()),
          contentType: file.type,
          extension: THUMBNAIL_EXTENSION_BY_MIME[file.type] ?? "jpg",
        }));
      } catch (r2Error) {
        // Fall back to Blob (e.g. the R2 token doesn't cover the bucket) rather than fail the upload.
        console.error("[DEFAULT_VIDEO_THUMBNAIL_R2_FAILED_FALLING_BACK_TO_BLOB]", r2Error);
      }
      // Content-hashed key: re-uploading the same file yields the same object.
      if (storageUrl && existing && existing.value !== storageUrl) {
        await deleteStoredThumbnail(existing.value);
      }
    }

    if (!storageUrl) {
      const ext = file.type.split("/")[1] || "jpg";
      const pathname = `settings/default-video-thumbnail.${ext}`;
      if (existing) {
        await deleteStoredThumbnail(existing.value);
      }
      const blob = await put(pathname, file, { access: getBlobAccess() });
      storageUrl = blob.url;
    }

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: storageUrl, updatedBy: adminUserId ?? undefined },
      update: { value: storageUrl, updatedBy: adminUserId ?? undefined },
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

    return NextResponse.json({ url: toAdminPreviewUrl(storageUrl), storageUrl });
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

    await deleteStoredThumbnail(setting.value);
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
