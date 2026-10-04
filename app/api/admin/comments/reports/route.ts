import { NextRequest } from "next/server";
import { z } from "zod";
import { commentResultResponse } from "@/lib/api/comment-response";
import { requireAdminForApi } from "@/lib/auth-utils";
import { listCommentReports } from "@/lib/modules/comments";
import { CommentReportStatus } from "@prisma/client";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { parsePaginationParams } from "@/lib/admin/query-parser";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi(
    "GET_COMMENT_REPORTS",
  );
  if (response) return response;
  const { searchParams } = new URL(req.url);
  const status = z.nativeEnum(CommentReportStatus).optional().catch(undefined).parse(searchParams.get("status") || undefined);
  // Reuses the shared admin pagination-parsing pattern (page/pageSize) for
  // consistency with the other admin list endpoints (videos/users/payments).
  const { page, pageSize } = parsePaginationParams(req, "createdAt");
  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const result = await listCommentReports(
      { status, page, pageSize },
      createAppContext({ actor }),
    );
    return commentResultResponse(result);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
