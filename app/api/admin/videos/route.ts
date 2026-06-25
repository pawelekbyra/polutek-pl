import { AccessTier, VideoStatus } from "@prisma/client";
import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import {
  getAdminVideoList,
  createAdminVideo,
  updateAdminVideo,
  deleteAdminVideo,
} from "@/lib/modules/video";
import type {
  CreateVideoInput,
  UpdateVideoInput,
} from "@/lib/modules/video/infrastructure/video.repository";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { parseVideoQueryParams } from "@/lib/services/admin/admin-query-parser";

export const dynamic = "force-dynamic";

type AdminVideoRequestBody = Record<string, unknown>;

function isRequestBody(value: unknown): value is AdminVideoRequestBody {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readTextField(body: AdminVideoRequestBody, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

function readNullableTextField(
  body: AdminVideoRequestBody,
  key: string,
): string | null | undefined {
  const value = body[key];
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function readBooleanField(body: AdminVideoRequestBody, key: string): boolean | undefined {
  const value = body[key];
  return typeof value === "boolean" ? value : undefined;
}

function readNumberField(body: AdminVideoRequestBody, key: string): number | undefined {
  const value = body[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readAccessTier(body: AdminVideoRequestBody, key: string): AccessTier | undefined {
  const value = body[key];
  if (typeof value !== "string") return undefined;
  return Object.values(AccessTier).includes(value as AccessTier)
    ? (value as AccessTier)
    : undefined;
}

function readVideoStatus(body: AdminVideoRequestBody, key: string): VideoStatus | undefined {
  const value = body[key];
  if (typeof value !== "string") return undefined;
  return Object.values(VideoStatus).includes(value as VideoStatus)
    ? (value as VideoStatus)
    : undefined;
}

function buildUpdatePayload(body: AdminVideoRequestBody): UpdateVideoInput {
  const payload: UpdateVideoInput = {
    id: readTextField(body, "id") ?? "",
  };

  const title = readTextField(body, "title");
  if (title !== undefined) payload.title = title;

  const slug = readTextField(body, "slug");
  if (slug !== undefined) payload.slug = slug;

  const description = readNullableTextField(body, "description");
  if (description !== undefined) payload.description = description;

  const descriptionEn = readNullableTextField(body, "descriptionEn");
  if (descriptionEn !== undefined) payload.descriptionEn = descriptionEn;

  const duration = readNullableTextField(body, "duration");
  if (duration !== undefined) payload.duration = duration;

  const thumbnailUrl = readNullableTextField(body, "thumbnailUrl");
  if (thumbnailUrl !== undefined) payload.thumbnailUrl = thumbnailUrl;

  const titleEn = readNullableTextField(body, "titleEn");
  if (titleEn !== undefined) payload.titleEn = titleEn;

  const videoUrl = readNullableTextField(body, "videoUrl");
  if (videoUrl !== undefined) payload.videoUrl = videoUrl;

  const tier = readAccessTier(body, "tier");
  if (tier !== undefined) payload.tier = tier;

  const status = readVideoStatus(body, "status");
  if (status !== undefined) payload.status = status;

  const isMainFeatured = readBooleanField(body, "isMainFeatured");
  if (isMainFeatured !== undefined) payload.isMainFeatured = isMainFeatured;

  const showInSidebar = readBooleanField(body, "showInSidebar");
  if (showInSidebar !== undefined) payload.showInSidebar = showInSidebar;

  const sidebarOrder = readNumberField(body, "sidebarOrder");
  if (sidebarOrder !== undefined) payload.sidebarOrder = sidebarOrder;

  return payload;
}

function buildCreatePayload(body: AdminVideoRequestBody): CreateVideoInput {
  const payload: CreateVideoInput = {
    title: readTextField(body, "title") ?? "",
    slug: readTextField(body, "slug") ?? "",
    tier: readAccessTier(body, "tier") ?? AccessTier.PUBLIC,
    publishAfterAssetReady: readBooleanField(body, "publishAfterAssetReady") === true,
  };

  const description = readNullableTextField(body, "description");
  if (description !== undefined) payload.description = description;

  const descriptionEn = readNullableTextField(body, "descriptionEn");
  if (descriptionEn !== undefined) payload.descriptionEn = descriptionEn;

  const duration = readNullableTextField(body, "duration");
  if (duration !== undefined) payload.duration = duration;

  const thumbnailUrl = readNullableTextField(body, "thumbnailUrl");
  if (thumbnailUrl !== undefined) payload.thumbnailUrl = thumbnailUrl;

  const titleEn = readNullableTextField(body, "titleEn");
  if (titleEn !== undefined) payload.titleEn = titleEn;

  return payload;
}

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id");
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } =
    await requireAdminForApi("GET_ADMIN_VIDEOS");
  if (response) return response;

  const actor = { type: "admin" as const, userId: adminUserId! };
  const ctx = createAppContext({ actor });
  const options = parseVideoQueryParams(req);

  try {
    const result = await getAdminVideoList(
      {
        ...options,
        isMainFeatured:
          options.isMainFeatured === undefined
            ? "ALL"
            : String(options.isMainFeatured),
        showInSidebar:
          options.showInSidebar === undefined
            ? "ALL"
            : String(options.showInSidebar),
        migrationStatus: options.migrationStatus || "ALL",
      },
      ctx,
    );
    return fromUseCaseResult(result);
  } catch (error: unknown) {
    scopedLogger.error("[GET_ADMIN_VIDEOS_ERROR]", error);
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id");
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } =
    await requireAdminForApi("POST_ADMIN_VIDEOS");
  if (response) return response;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });
    const parsedBody: unknown = await req.json();
    const body = isRequestBody(parsedBody) ? parsedBody : {};

    if (body.id) {
      const result = await updateAdminVideo(buildUpdatePayload(body), ctx);
      return fromUseCaseResult(result);
    }

    const result = await createAdminVideo(buildCreatePayload(body), ctx);
    return fromUseCaseResult(result);
  } catch (error: unknown) {
    scopedLogger.error("[ADMIN_VIDEO_POST_ERROR]", error);
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = req.headers.get("x-request-id");
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi(
    "DELETE_ADMIN_VIDEOS",
  );
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing video ID" }, { status: 400 });
  }

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });
    const result = await deleteAdminVideo(id, ctx);
    return fromUseCaseResult(result);
  } catch (error: unknown) {
    scopedLogger.error("[ADMIN_VIDEO_DELETE_ERROR]", error);
    return handleApiError(error);
  }
}
