import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import {
  getAdminVideoList,
  createAdminVideo,
  updateAdminVideo,
  deleteAdminVideo,
  buildAdminVideoCreatePayload,
  buildAdminVideoUpdatePayload,
  isAdminVideoRequestBody,
} from "@/lib/modules/video";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { parseVideoQueryParams } from "@/lib/services/admin/admin-query-parser";

export const dynamic = "force-dynamic";

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
    const body = isAdminVideoRequestBody(parsedBody) ? parsedBody : {};

    if (body.id) {
      const result = await updateAdminVideo(buildAdminVideoUpdatePayload(body), ctx);
      return fromUseCaseResult(result);
    }

    const result = await createAdminVideo(buildAdminVideoCreatePayload(body), ctx);
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
