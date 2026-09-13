import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { listAdminComments, commentErrorStatus } from "@/lib/modules/comments";
import { CommentStatus } from "@prisma/client";
import { requireAdminForApi } from "@/lib/auth-utils";
import { parsePaginationParams } from "@/lib/admin/query-parser";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { adminUserId, response } =
    await requireAdminForApi("GET_ADMIN_COMMENTS");
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;
    const status = searchParams.get("status") as CommentStatus | undefined;
    const videoId = searchParams.get("videoId") || undefined;
    // Reuses the shared admin pagination-parsing pattern (page/pageSize) for
    // consistency with the other admin list endpoints (videos/users/payments/reports).
    const { page, pageSize } = parsePaginationParams(request, "createdAt");

    const ctx = createAppContext({
      actor: { type: "admin", userId: adminUserId! },
    });
    const result = await listAdminComments({ q, status, videoId, page, pageSize }, ctx);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.message },
        { status: commentErrorStatus(result.error) },
      );
    }

    return NextResponse.json(result.data);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
